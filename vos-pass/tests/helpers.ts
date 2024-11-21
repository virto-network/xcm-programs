import { AnyJson, ISubmittableResult } from "@polkadot/types/types";

import { EventRecord } from "@polkadot/types/interfaces";
import { KeyringPair } from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { assertObjectMatch } from "jsr:@std/assert";

export const signSendAndWait = (
  tx: SubmittableExtrinsic<"promise">,
  signer: KeyringPair
) =>
  new Promise<ISubmittableResult>((resolve, reject) =>
    tx.signAndSend(signer, (result) => {
      switch (true) {
        case result.isError:
          return reject(result.status);
        case result.isInBlock:
          return resolve(result);
        case result.isWarning:
          console.warn(result.toHuman(true));
      }
    })
  );

type ExpectedEventRecordLike = {
  event: {
    section: string;
    method: string;
    data?: AnyJson;
  };
};
export function eventPartiallyMatches(
  value: EventRecord,
  expected: ExpectedEventRecordLike
): boolean | undefined {
  // This tester only asserts equality for `EventRecord`s
  if (typeof value !== "object" || value.event === undefined) {
    return undefined;
  }

  if (
    value.event.section !== expected.event.section ||
    value.event.method !== expected.event.method
  ) {
    return false;
  }

  if (value.event.data !== undefined && expected.event.data !== undefined) {
    try {
      assertObjectMatch(
        value.event.data.toHuman() as unknown as Record<string, unknown>,
        expected.event.data as unknown as Record<string, unknown>
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  return true;
}
