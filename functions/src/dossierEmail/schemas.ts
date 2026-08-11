import { z } from "zod";

export const dossierRecapSchema = z.object({
  dossierId: z.string().trim().min(1),
});

export type DossierRecapInput = z.infer<typeof dossierRecapSchema>;
