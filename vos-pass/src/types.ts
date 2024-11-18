export { type BlockNumber } from "@polkadot/types/interfaces";
export { type Compact } from "@polkadot/types";

export type AttestationMeta<Cx> = {
  deviceId: Uint8Array;
  context: Cx;
};

export type Attestation<Cx> = {
  meta: AttestationMeta<Cx>;
  authenticatorData: Uint8Array;
  clientData: Uint8Array;
  publicKey: Uint8Array;
};

export type AssertionMeta<Cx> = {
  userId: Uint8Array;
  context: Cx;
};

export type Assertion<Cx> = {
  meta: AssertionMeta<Cx>;
  authenticatorData: Uint8Array;
  clientData: Uint8Array;
  signature: Uint8Array;
};
