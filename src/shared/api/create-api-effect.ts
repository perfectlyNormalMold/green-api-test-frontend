import { createEffect } from "effector";

export function createApiEffect<Params, Result, Failure extends Error>(
  apiMethod: (params: Params) => Promise<Result>,
) {
  return createEffect<Params, Result, Failure>(apiMethod);
}
