/** Strip leading `v` and normalize semver-like version strings for comparison. */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}
