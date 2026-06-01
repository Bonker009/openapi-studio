import { getDisplayNames } from "@/src/shared/utils/spec-display";
import type { ApiSpecificationSummary, SortKey } from "../types";
import type { DisplaySpec } from "@/src/shared/utils/spec-display";

export function filterAndSortSpecs(
  specs: ApiSpecificationSummary[],
  search: string,
  sort: SortKey
): DisplaySpec[] {
  const query = search.trim().toLowerCase();
  let list = getDisplayNames(specs);
  if (query) {
    list = list.filter(
      (spec) =>
        spec.displayTitle.toLowerCase().includes(query) ||
        spec.id.toLowerCase().includes(query) ||
        spec.version.toLowerCase().includes(query) ||
        (spec.description?.toLowerCase().includes(query) ?? false)
    );
  }
  return [...list].sort((a, b) => {
    if (sort === "name") {
      return a.displayTitle.localeCompare(b.displayTitle);
    }
    if (sort === "version") {
      return a.version.localeCompare(b.version);
    }
    return (
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  });
}
