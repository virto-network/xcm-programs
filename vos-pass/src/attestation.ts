import type { AttestationMeta, Attestation as TAttestation } from "./types.ts";
import { Compact, u32 } from "@polkadot/types";
import { hexToU8a, u8aToHex } from "@polkadot/util";

type BlockNumber = Compact<u32>;

export class Attestation {
  meta: AttestationMeta<BlockNumber>;
  authenticatorData: `0x${string}`;
  clientData: `0x${string}`;
  publicKey: Uint8Array;

  constructor(
    blockNumber: BlockNumber,
    deviceId: `0x${string}`,
    tAttestation: Omit<TAttestation<BlockNumber>, "meta">
  ) {
    this.meta = {
      context: blockNumber,
      deviceId: hexToU8a(deviceId),
    };
    this.authenticatorData = u8aToHex(tAttestation.authenticatorData);
    this.clientData = u8aToHex(tAttestation.clientData);
    this.publicKey = tAttestation.publicKey;
  }
}
