export type AppErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "EXTERNAL"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: { code: AppErrorCode; status?: number; cause?: unknown } = {
      code: "INTERNAL",
    }
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? statusForCode(options.code);
    this.cause = options.cause;
  }
}

function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "UNAUTHORIZED":
      return 401;
    case "EXTERNAL":
      return 502;
    default:
      return 500;
  }
}
