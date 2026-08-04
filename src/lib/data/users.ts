import { call } from "./callable";

/** Promote or demote a colleague. Server-guarded: admin caller, same scope,
 *  never the last admin. */
export const callSetColleagueAdmin = (uid: string, isAdmin: boolean) =>
  call<{ uid: string; isAdmin: boolean }, { ok: true }>("setColleagueAdmin", { uid, isAdmin })
    .then(() => undefined);

/** Delete a colleague's account. Dossiers, chats and stored files are kept. */
export const callDeleteColleague = (uid: string) =>
  call<{ uid: string }, { ok: true }>("deleteColleague", { uid }).then(() => undefined);

/** Delete the signed-in user's own account. Refused for an admin. */
export const callDeleteMyAccount = () =>
  call<Record<string, never>, { ok: true }>("deleteMyAccount", {}).then(() => undefined);
