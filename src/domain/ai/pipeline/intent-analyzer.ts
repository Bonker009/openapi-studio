export function analyzeIntent(userIntent?: string): {
  normalizedIntent: string;
  keywords: string[];
} {
  const normalizedIntent = (userIntent ?? "Generate a smoke test flow for key endpoints")
    .trim()
    .slice(0, 2000);
  const keywords = normalizedIntent
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 2);
  return { normalizedIntent, keywords };
}
