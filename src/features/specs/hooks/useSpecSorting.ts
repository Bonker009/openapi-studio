"use client";

import { useState } from "react";
import type { SortKey } from "../types";

export function useSpecSorting(initial: SortKey = "modified") {
  const [sort, setSort] = useState<SortKey>(initial);
  const sortLabel =
    sort === "modified"
      ? "Last modified"
      : sort === "name"
        ? "Name"
        : "Version";
  return { sort, setSort, sortLabel };
}
