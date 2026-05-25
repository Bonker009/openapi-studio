/** Letters, numbers, dots, underscores, hyphens (hostnames like api.example.com). */
const CANONICAL_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_SPEC_ID_LENGTH = 128;

export function validateSpecId(id: string): boolean {
  if (!id || id.length > MAX_SPEC_ID_LENGTH) return false;
  if (id.includes("..") || id.includes("/") || id.includes("\\")) return false;
  return CANONICAL_ID_REGEX.test(id);
}
