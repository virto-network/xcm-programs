import { XcmProgramsExecutor } from "./executor";
import { topupThenInitiativeSetup } from "./initiatives";
import { topupThenCreateCommunity } from "./top-up-then-create-community";
import { topupThenInitiativeVote } from "./top-up-then-vote-initiative";
import { ExecutableFunctionOf } from "./types";

export { XcmProgramsExecutor } from "./executor";

export function globallyInjectPrograms(executor: XcmProgramsExecutor) {
  const functions: Function[] = [
    topupThenCreateCommunity,
    topupThenInitiativeSetup,
    topupThenInitiativeVote
  ];

  for (const fn of functions) {
    (globalThis as any)[fn.name] = (...params: any[]) =>
      executor.execute(fn as ExecutableFunctionOf<any>, ...params);
  }
}
