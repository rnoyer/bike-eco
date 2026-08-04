/**
 * Photo limits for the vehicle submission funnels (b2c + b2b).
 *
 * Imported by both Zod schemas and by `PhotoPicker`, so the cap the picker
 * enforces and the one the schema rejects on can never drift apart.
 */
export const MAX_PHOTOS = 10;
