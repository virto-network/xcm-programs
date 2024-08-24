import { XcmProgramsExecutor } from "./executor";
import { topupThenCreateCommunity } from "./top-up-then-create-community";
import { withdraw } from "./top-up-then-withdraw";
import { ExecutableFunctionOf } from "./types";

export { XcmProgramsExecutor } from "./executor";

export function globallyInjectPrograms(executor: XcmProgramsExecutor) {
  const functions: Function[] = [
    topupThenCreateCommunity,
    withdraw
  ];

  for (const fn of functions) {
    globalThis[fn.name] = (...params: any[]) =>
      executor.execute(fn as ExecutableFunctionOf<any>, ...params);
  }
}
