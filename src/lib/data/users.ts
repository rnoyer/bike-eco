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

/** The profile fields a user may edit on their own account. Email is absent:
 *  it is the Auth credential, not a profile field. */
export interface ProfilePatch {
  nom?: string;
  prenom?: string;
  telephone?: string;
}

/**
 * Update the signed-in user's own nom / prénom / téléphone.
 *
 * Server-side, not a direct Firestore write: the same values are denormalized
 * into `dossiers/{id}.submitter` and `companies/{id}.createdByName`, which no
 * client may write. The callable rewrites all of them together.
 */
export const callUpdateMyProfile = (patch: ProfilePatch) =>
  call<ProfilePatch, { ok: true }>("updateMyProfile", patch).then(() => undefined);
