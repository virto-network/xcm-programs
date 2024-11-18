import {
  AssertionMeta,
  BlockNumber,
  Compact,
  Assertion as TAssertion,
} from "./types.ts";

import { u8aToHex } from "@polkadot/util";

export class Assertion {
  meta: AssertionMeta<Compact<BlockNumber>>;
  authenticatorData: `0x${string}`;
  clientData: `0x${string}`;
  signature: Uint8Array;

  constructor(tAssertion: TAssertion<Compact<BlockNumber>>) {
    this.meta = tAssertion.meta;
    this.authenticatorData = u8aToHex(tAssertion.authenticatorData);
    this.clientData = u8aToHex(tAssertion.clientData);
    this.signature = tAssertion.signature;
  }
}
