import type { SpecListItem } from "@/src/infrastructure/repositories/contracts";
import type { DisplaySpec } from "@/src/shared/utils/spec-display";

export type { SpecListItem, DisplaySpec };

export type ApiSpecificationSummary = SpecListItem;

export type SortKey = "modified" | "name" | "version";
export type ViewMode = "list" | "grid";
