/** Strips non-digits from input, optionally capping length. For numeric text fields. */
export const digitsOnly =
  (max?: number) =>
  (text: string): string => {
    const digits = text.replace(/\D/g, "");
    return max ? digits.slice(0, max) : digits;
  };
