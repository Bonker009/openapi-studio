/** Server-side AI availability (reads process.env at request time). */

export function getAiDisabledReason(): string | null {
  if (process.env.ENABLE_AI === "false") {
    return "ENABLE_AI is set to false on the server.";
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return (
      "OPENAI_API_KEY is not set on the server. " +
      "If you use Docker, add env_file: .env to the web service and restart the container."
    );
  }
  return null;
}

export function isAiModuleEnabled(): boolean {
  return getAiDisabledReason() === null;
}
