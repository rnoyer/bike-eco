import { setGlobalOptions } from "firebase-functions";

/**
 * Global function options, in their own module for one reason: **`setGlobalOptions`
 * only affects functions defined after it runs**, and imports are hoisted.
 *
 * Calling it in the body of `index.ts` looks right and silently is not — every
 * `export { … } from "./registration"` is evaluated first, so all twelve callables
 * were already defined (and pinned to the `us-central1` default) by the time the
 * call executed. Only `sendB2cSubmission`, declared further down in that same body,
 * picked the region up. Deploying that state split the codebase across two regions.
 *
 * So: this module is imported for its side effect before anything that defines a
 * function — first in `index.ts`, and again at the top of `callable.ts`, which every
 * feature module already imports. Node caches it, so it runs exactly once; the second
 * import is what keeps the guarantee local instead of resting on statement order in
 * a file someone may reorder later.
 *
 * `region`: `europe-west9`, co-located with `bike-eco-db` and the Storage bucket.
 * The client callers must agree — `getFunctions(app, …)` in `firebase.core.ts` and
 * `REGION` in `src/features/b2c-submission/submit.ts`.
 *
 * `maxInstances`: bounds the blast radius of autoscaling. Per-function caps still apply.
 *
 * Verify without deploying — every export carries its resolved region:
 *   npm run build && node -e 'for (const [k,v] of Object.entries(require("./lib/index.js")))
 *     if (v?.__endpoint) console.log(k, v.__endpoint.region ?? "(none)")'
 */
setGlobalOptions({ maxInstances: 10, region: "europe-west9" });
