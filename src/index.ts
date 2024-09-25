import { XcmProgramsExecutor } from "./executor";
import { initiativeSetup } from "./initiatives";
import { topupThenCreateCommunity } from "./top-up-then-create-community";
import { withdraw } from "./withdraw";
import { initiativeVote } from "./vote-initiative";
import { ExecutableFunctionOf } from "./types";
import { deposit } from "./deposit";

export { XcmProgramsExecutor } from "./executor";

export function globallyInjectPrograms(executor: XcmProgramsExecutor) {
  const functions: Function[] = [
    topupThenCreateCommunity,
    withdraw,
    deposit,
    initiativeSetup,
    initiativeVote
  ];

  for (const fn of functions) {
    globalThis[fn.name] = (...params: any[]) =>
      executor.execute(fn as ExecutableFunctionOf<any>, ...params);
  }
}
