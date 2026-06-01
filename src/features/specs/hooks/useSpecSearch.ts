"use client";

import { useState } from "react";

export function useSpecSearch(initial = "") {
  const [search, setSearch] = useState(initial);
  return { search, setSearch };
}
