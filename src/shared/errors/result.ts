import type { AppError } from "./app-error";

export type Ok<T> = { ok: true; value: T };
export type Err<E = AppError> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Err<E> {
  return { ok: false, error };
}

export async function tryResult<T>(
  fn: () => Promise<T>,
  mapError: (cause: unknown) => AppError
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(mapError(cause));
  }
}
