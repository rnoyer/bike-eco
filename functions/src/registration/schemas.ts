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
    // Optional French VAT number: "FR" + a 2-character key + the 9-digit SIREN,
    // i.e. the first 9 digits of the SIRET (checked below). `nullish`, not
    // `optional`: the callable wire format cannot carry `undefined`, so a client
    // sending `tva: undefined` is encoded by the SDK as an explicit `null`.
    tva: z.string().regex(/^FR[0-9A-Z]{2}\d{9}$/).nullish(),
    companyName: z.string().trim().min(1),
    companyDepartement: z.string().trim().min(1), // company location (step 1)
    companyVille: z.string().trim().min(1),
    ...profile,
  })
  .superRefine((v, ctx) => {
    if (v.tva && v.tva.slice(4) !== v.siret.slice(0, 9)) {
      ctx.addIssue({ code: "custom", message: "tva/siret mismatch", path: ["tva"] });
    }
  })
  .and(registerCredential);

export const acceptInviteSchema = z
  .object({
    code: z.string().trim().min(1),
    // Optional "région gérée", honoured only for a back-office invitation (see
    // acceptInviteCore). `nullish`, like `tva`: the callable wire format cannot
    // carry `undefined`, so "Toute la France" arrives as an explicit null.
    notificationRegion: z.enum(["NORTH", "SOUTH"]).nullish(),
    ...profile,
  })
  .and(acceptCredential);

export const sendInviteSchema = z.object({ email: z.email() });
export const resolveInviteSchema = z.object({ code: z.string().trim().min(1) });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export type ResolveInviteInput = z.infer<typeof resolveInviteSchema>;

export const companyActionSchema = z.object({ companyId: z.string().trim().min(1) });
