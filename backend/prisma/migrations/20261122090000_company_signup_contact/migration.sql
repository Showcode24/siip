-- Company sign-up asks for business details and contact numbers.
ALTER TABLE "Company" ADD COLUMN "phone" TEXT;
ALTER TABLE "Company" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "User" ADD COLUMN "signupCompany" JSONB;
