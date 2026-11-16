import { z } from "zod";

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

export const signUpSchema = z.object({
  accountType: z.enum(["GRADUATE", "COMPANY"]),
  firstName: personName,
  lastName: personName,
  email,
  password,
  // NDPA 2023: explicit consent to the privacy notice is required to register.
  consent: z.literal(true, { error: "You must accept the privacy notice to continue" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

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
