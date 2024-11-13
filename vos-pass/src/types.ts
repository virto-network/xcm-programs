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
