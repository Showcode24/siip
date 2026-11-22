import { z } from "zod";
import { requiredPhoneNumber } from "./common";

const email = z
  .email("Enter a valid email address")
  .max(254)
  .transform((v) => v.trim().toLowerCase());

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const personName = z.string().trim().min(1).max(80);

// NDPA 2023: explicit consent to the privacy notice is required to register.
const consent = z.literal(true, { error: "You must accept the privacy notice to continue" });

export const graduateSignUpSchema = z.object({
  accountType: z.literal("GRADUATE"),
  firstName: personName,
  lastName: personName,
  email,
  password,
  consent,
});

/**
 * Companies sign up with their business details, not a person's name. These are
 * kept with the account and pre-fill the company details step after the email
 * is verified, where the rest (industry, country, city) is added.
 */
export const companySignUpSchema = z.object({
  accountType: z.literal("COMPANY"),
  companyName: z.string().trim().min(2, "Enter your company name").max(160),
  registrationNumber: z
    .string()
    .trim()
    .min(3, "Enter your RC number")
    .max(40)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/, "Use letters, numbers, spaces, dots, slashes or dashes"),
  address: z.string().trim().min(5, "Enter your company address").max(300),
  phone: requiredPhoneNumber,
  whatsapp: requiredPhoneNumber,
  email,
  password,
  consent,
});

export const signUpSchema = z.discriminatedUnion("accountType", [graduateSignUpSchema, companySignUpSchema]);
export type SignUpInput = z.infer<typeof signUpSchema>;
export type CompanySignUpInput = z.infer<typeof companySignUpSchema>;

/** What a company gave at sign-up, held until its company record is created. */
export type SignupCompany = Pick<CompanySignUpInput, "companyName" | "registrationNumber" | "address" | "phone" | "whatsapp">;

export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(128),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The public contact form. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120),
  email,
  topic: z.enum(["graduate", "company", "certificate", "other"]),
  message: z.string().trim().min(10, "Add a few more details").max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const resendVerificationSchema = z.object({ email });

export const verifyEmailQuery = z.object({ token: z.string().min(1).max(2048) });
