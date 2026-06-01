export type SpecDisplayInput = {
  id: string;
  title: string;
  description?: string;
  version: string;
  lastModified: string;
};

export type DisplaySpec = SpecDisplayInput & { displayTitle: string };

/** Assign disambiguated display titles when multiple specs share the same title. */
export function getDisplayNames<T extends SpecDisplayInput>(
  specs: T[]
): (T & { displayTitle: string })[] {
  const nameCount: Record<string, number> = {};
  return specs.map((spec) => {
    const base = spec.title || "Untitled";
    if (!nameCount[base]) {
      nameCount[base] = 1;
      return { ...spec, displayTitle: base };
    }
    nameCount[base]++;
    return { ...spec, displayTitle: `${base} (${nameCount[base]})` };
  });
}
