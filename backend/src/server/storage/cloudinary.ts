import { randomBytes } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "@/server/env";
import { AppError, errors } from "@/server/lib/errors";

export type ResourceType = "image" | "raw";
/** "authenticated" assets are only reachable through signed, expiring URLs. */
export type DeliveryType = "upload" | "authenticated";

interface UploadKind {
  folder: string;
  resourceType: ResourceType;
  deliveryType: DeliveryType;
  formats: readonly string[];
  maxBytes: number;
}

const MB = 1024 * 1024;

export const UPLOAD_KINDS = {
  // CVs carry personal data: stored privately, served via short-lived signed URLs.
  cv: {
    folder: "siip/cvs",
    resourceType: "raw",
    deliveryType: "authenticated",
    formats: ["pdf"],
    maxBytes: 5 * MB,
  },
  photo: {
    folder: "siip/photos",
    resourceType: "image",
    deliveryType: "upload",
    formats: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 2 * MB,
  },
  logo: {
    folder: "siip/logos",
    resourceType: "image",
    deliveryType: "upload",
    formats: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 2 * MB,
  },
  lessonAttachment: {
    folder: "siip/lessons",
    resourceType: "raw",
    deliveryType: "upload",
    formats: ["pdf", "docx", "pptx", "xlsx"],
    maxBytes: 10 * MB,
  },
} as const satisfies Record<string, UploadKind>;

export type UploadKindName = keyof typeof UPLOAD_KINDS;

let configured = false;

function client() {
  if (!configured) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env();
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new AppError("INTERNAL_ERROR", "File uploads are not configured");
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
  maxBytes: number;
  allowedFormats: readonly string[];
}

/**
 * Signature for a direct browser → Cloudinary upload. The public_id is chosen
 * here and scoped to the owner, so `confirmUpload` can check that the asset
 * being confirmed is one we issued to this owner.
 */
export function createSignedUpload(
  kindName: UploadKindName,
  ownerId: string,
  extension?: string,
): SignedUpload {
  const kind = UPLOAD_KINDS[kindName];
  const c = client();
  // Raw files keep their extension in the public id; images get theirs from Cloudinary.
  let suffix = "";
  if (kind.resourceType === "raw") {
    const ext = (extension ?? kind.formats[0]).toLowerCase();
    if (!(kind.formats as readonly string[]).includes(ext)) {
      throw errors.badRequest(`Unsupported file type. Allowed: ${kind.formats.join(", ")}.`);
    }
    suffix = `.${ext}`;
  }
  const publicId = `${kind.folder}/${ownerId}/${randomBytes(9).toString("base64url")}${suffix}`;
  const params: Record<string, string> = {
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: kind.deliveryType,
    overwrite: "false",
  };
  if (kind.resourceType === "image") params.allowed_formats = kind.formats.join(",");
  const signature = c.utils.api_sign_request(params, env().CLOUDINARY_API_SECRET!);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env().CLOUDINARY_CLOUD_NAME}/${kind.resourceType}/upload`,
    fields: { ...params, signature, api_key: env().CLOUDINARY_API_KEY! },
    publicId,
    maxBytes: kind.maxBytes,
    allowedFormats: kind.formats,
  };
}

export function assertOwnedPublicId(kindName: UploadKindName, ownerId: string, publicId: string) {
  const prefix = `${UPLOAD_KINDS[kindName].folder}/${ownerId}/`;
  if (!publicId.startsWith(prefix) || publicId.includes("..")) {
    throw errors.forbidden("This upload does not belong to you");
  }
}

function formatOf(resource: Pick<UploadApiResponse, "format" | "public_id">) {
  if (resource.format) return resource.format.toLowerCase();
  // Raw files have no `format`; the extension is part of the public id/URL.
  const match = /\.([a-z0-9]+)$/i.exec(resource.public_id);
  return match ? match[1].toLowerCase() : "";
}

export interface ConfirmedUpload {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
}

/**
 * Looks the asset up via the Admin API and enforces type and size limits
 * server-side (the browser can't be trusted). Invalid uploads are deleted.
 */
export async function confirmUpload(
  kindName: UploadKindName,
  ownerId: string,
  publicId: string,
): Promise<ConfirmedUpload> {
  assertOwnedPublicId(kindName, ownerId, publicId);
  const kind = UPLOAD_KINDS[kindName];
  const c = client();

  let resource: UploadApiResponse;
  try {
    resource = (await c.api.resource(publicId, {
      resource_type: kind.resourceType,
      type: kind.deliveryType,
    })) as UploadApiResponse;
  } catch {
    throw errors.notFound("Uploaded file");
  }

  const format = formatOf(resource);
  const tooBig = resource.bytes > kind.maxBytes;
  let wrongType = !(kind.formats as readonly string[]).includes(format);
  // Cloudinary validates images itself but not raw files, so sniff the bytes.
  if (!wrongType && !tooBig && kind.resourceType === "raw") {
    wrongType = !(await hasExpectedSignature(publicId, kind.deliveryType, format, resource.secure_url));
  }
  if (tooBig || wrongType) {
    await deleteAsset(publicId, kind.resourceType, kind.deliveryType);
    throw errors.badRequest(
      tooBig
        ? `File is too large. The limit is ${kind.maxBytes / MB} MB.`
        : `Unsupported file type. Allowed: ${kind.formats.join(", ")}.`,
    );
  }

  return { publicId, url: resource.secure_url, bytes: resource.bytes, format };
}

const MAGIC: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  docx: [0x50, 0x4b, 0x03, 0x04], // ZIP container
  pptx: [0x50, 0x4b, 0x03, 0x04],
  xlsx: [0x50, 0x4b, 0x03, 0x04],
};

async function hasExpectedSignature(
  publicId: string,
  deliveryType: DeliveryType,
  format: string,
  publicUrl: string,
): Promise<boolean> {
  const magic = MAGIC[format];
  if (!magic) return false;
  const url = deliveryType === "authenticated" ? privateDownloadUrl(publicId, "raw", 60) : publicUrl;
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${magic.length - 1}` } });
    if (!res.ok) return false;
    const head = new Uint8Array(await res.arrayBuffer()).slice(0, magic.length);
    return magic.every((byte, i) => head[i] === byte);
  } catch {
    return false;
  }
}

export async function deleteAsset(publicId: string, resourceType: ResourceType, type: DeliveryType) {
  try {
    await client().uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true });
  } catch {
    // Best effort; orphaned assets are harmless and can be swept later.
  }
}

/** A download link for a private asset that expires after `ttlSeconds`. */
export function privateDownloadUrl(publicId: string, resourceType: ResourceType, ttlSeconds = 600) {
  return client().utils.private_download_url(publicId, "", {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    attachment: true,
  });
}

/** Server-side upload of a generated buffer (e.g. a certificate PDF). */
export async function uploadBuffer(
  buffer: Buffer,
  opts: { publicId: string; resourceType: ResourceType; deliveryType: DeliveryType },
): Promise<ConfirmedUpload> {
  const c = client();
  const resource = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = c.uploader.upload_stream(
      {
        public_id: opts.publicId,
        resource_type: opts.resourceType,
        type: opts.deliveryType,
        overwrite: true,
      },
      (err, result) => (err || !result ? reject(err ?? new Error("Upload failed")) : resolve(result)),
    );
    stream.end(buffer);
  });
  return {
    publicId: resource.public_id,
    url: resource.secure_url,
    bytes: resource.bytes,
    format: formatOf(resource),
  };
}
