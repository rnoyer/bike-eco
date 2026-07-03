import type { B2bSubmissionForm } from "./schema";

/**
 * STUB (UI-only pass). Real implementation (later milestone): create a `dossiers`
 * document with status "a_traiter", `companyId`/`submittedBy` from the authed
 * user's claims, `region` derived from the submitter's département; upload
 * `photos` to Storage and set `thumbnailUrl`. For now we just simulate latency so
 * the funnel's submit → confirmation flow is exercised end to end.
 */
export async function submitB2bSubmission(
  values: B2bSubmissionForm
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (__DEV__) console.log("[stub] submitB2bSubmission", values);
}
