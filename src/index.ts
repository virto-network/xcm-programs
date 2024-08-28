import { XcmProgramsExecutor } from "./executor";
import { initiativeSetup } from "./initiatives";
import { topupThenCreateCommunity } from "./top-up-then-create-community";
import { initiativeVote } from "./vote-initiative";
import { ExecutableFunctionOf } from "./types";

export { XcmProgramsExecutor } from "./executor";

export function globallyInjectPrograms(executor: XcmProgramsExecutor) {
  const functions: Function[] = [
    topupThenCreateCommunity,
    initiativeSetup,
    initiativeVote
  ];

  for (const fn of functions) {
    globalThis[fn.name] = (...params: any[]) =>
      executor.execute(fn as ExecutableFunctionOf<any>, ...params);
  }
}
