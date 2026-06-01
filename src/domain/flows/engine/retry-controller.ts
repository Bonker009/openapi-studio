/** Placeholder for future per-step retry policies. */
export class RetryController {
  readonly maxAttempts: number;

  constructor(maxAttempts = 1) {
    this.maxAttempts = Math.max(1, maxAttempts);
  }

  shouldRetry(attempt: number, _outcome: string): boolean {
    return attempt < this.maxAttempts;
  }
}
