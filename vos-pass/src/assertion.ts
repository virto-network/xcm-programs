import {
  AssertionMeta,
  BlockNumber,
  Compact,
  Assertion as TAssertion,
} from "./types";

import { u8aToHex } from "@polkadot/util";

export class Assertion {
  meta: AssertionMeta<Compact<BlockNumber>>;
  authenticatorData: `0x${string}`;
  clientData: `0x${string}`;
  signature: `0x${string}`;

  constructor(tAssertion: TAssertion<Compact<BlockNumber>>) {
    this.meta = tAssertion.meta;
    this.authenticatorData = u8aToHex(tAssertion.authenticatorData);
    this.clientData = u8aToHex(tAssertion.clientData);
    this.signature = u8aToHex(tAssertion.signature);
  }
}
