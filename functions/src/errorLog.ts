/**
 * The structured payload behind the one log line that fires when a callable
 * fails for a reason `toHttps` does not recognise.
 *
 * It lives in its own module, apart from `callable.ts`, so it is reachable from
 * a unit test: importing `callable.ts` runs `initializeApp()` and the
 * `setGlobalOptions` side effect, which the house test setup does not carry.
 * Same reason the feature modules keep their logic in `core.ts`.
 */

/** What the logger receives. Field names are also the log-based metric filters. */
export interface ErrorLogEntry {
  function: string;
  uid: string;
  errorName: string;
  error: string;
  stack?: string;
}

/**
 * Which function is running.
 *
 * Gen 2 functions run on Cloud Run, which sets `K_SERVICE` to the service name —
 * for a Firebase function, its own name. Reading it here means a new callable is
 * identified in the logs without anyone remembering to pass a name at the
 * definition site, across all sixteen of them.
 *
 * Caveat worth knowing when reading logs: Cloud Run service names are lowercase,
 * so `registerCompany` appears as `registercompany`.
 */
export function callableName(env: Record<string, string | undefined> = process.env): string {
  return env.K_SERVICE ?? "unknown";
}

/**
 * Build the log entry for an unexpected failure.
 *
 * `uid` is the caller from the **verified** token, never from `req.data`. A
 * signed-out caller becomes `"anonymous"` rather than dropping the field: a
 * field that is always present keeps the alerting filters simple.
 */
export function internalErrorLog(
  err: unknown,
  uid: string | null,
  env: Record<string, string | undefined> = process.env,
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    function: callableName(env),
    uid: uid ?? "anonymous",
    errorName: err instanceof Error ? err.name : "unknown",
    error: err instanceof Error ? err.message : String(err),
  };
  // Only a real Error carries one, and it is the reason to open the log at all.
  if (err instanceof Error && err.stack) entry.stack = err.stack;
  return entry;
}
