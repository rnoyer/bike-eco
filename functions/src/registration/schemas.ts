import { z } from "zod";

const profile = {
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  telephone: z.string().regex(/^\d{10}$/),
};

// Company signup: password mode carries the new account's email + password.
const registerCredential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), email: z.email(), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
]);

// Invited signup: the email comes from the invitation, so password mode needs only a password.
const acceptCredential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
]);

export const registerCompanySchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/),
    companyName: z.string().trim().min(1),
    companyDepartement: z.string().trim().min(1), // company location (step 1)
    companyVille: z.string().trim().min(1),
    ...profile,
  })
  .and(registerCredential);

export const acceptInviteSchema = z
  .object({ code: z.string().trim().min(1), ...profile })
  .and(acceptCredential);

export const sendInviteSchema = z.object({ email: z.email() });
export const resolveInviteSchema = z.object({ code: z.string().trim().min(1) });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export type ResolveInviteInput = z.infer<typeof resolveInviteSchema>;

export const companyActionSchema = z.object({ companyId: z.string().trim().min(1) });
export type CompanyActionInput = z.infer<typeof companyActionSchema>;
