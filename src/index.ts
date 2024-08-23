import { XcmProgramsExecutor } from "./executor";
import { topupThenCreateCommunity } from "./top-up-then-create-community";
import { topupThenWithdraw } from "./top-up-then-withdraw";
import { ExecutableFunctionOf } from "./types";

export { XcmProgramsExecutor } from "./executor";

export function globallyInjectPrograms(executor: XcmProgramsExecutor) {
  const functions: Function[] = [
    topupThenCreateCommunity,
    topupThenWithdraw
  ];

  for (const fn of functions) {
    globalThis[fn.name] = (...params: any[]) =>
      executor.execute(fn as ExecutableFunctionOf<any>, ...params);
  }
}
