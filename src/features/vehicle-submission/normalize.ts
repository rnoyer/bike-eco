/**
 * The vehicle sub-answers that only exist when their parent question is "oui".
 * Both submission funnels' schemas define them identically, so this is stated
 * once here rather than per funnel.
 */
export interface ConditionalCheckboxes {
  electrique: string;
  materiel: string[];
  aKeyless: string | null;
  keyless: string[];
}

/**
 * Drop the checkbox groups whose parent question was not answered "oui".
 *
 * The funnel deliberately *keeps* the ticked boxes in form state when the user
 * flips the parent dropdown back to "non": an accidental toggle should not
 * throw away what they entered, and flipping back restores it. Both funnels'
 * schemas run this on parse, so that convenience stops at the form — what
 * reaches Firestore and the emails can never be
 * `{ electrique: "non", materiel: ["J'ai la batterie"] }`.
 *
 * It runs at parse time rather than in a `useEffect` that clears the field:
 * clearing the form state is what would lose the user's ticks, and a submit
 * handler that normalised instead would leave the two funnels (and the public
 * endpoint's own copy of this rule) free to drift apart.
 */
export function clearUnaskedCheckboxes<T extends ConditionalCheckboxes>(
  values: T,
): T {
  return {
    ...values,
    materiel: values.electrique === "oui" ? values.materiel : [],
    keyless: values.aKeyless === "oui" ? values.keyless : [],
  };
}
