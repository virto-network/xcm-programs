import "@polkadot/api-augment/kusama";

import * as hash from "hash-wasm";

import { ApiPromise } from "@polkadot/api";
import { Attestation } from "./attestation.ts";
import { BlockNumber } from "@polkadot/types/interfaces";
import { Compact } from "@polkadot/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { hexToU8a } from "@polkadot/util";

/**
 *
 */
export class Pass {
  static async generateChallenge(
    api: ApiPromise
  ): Promise<[Uint8Array, Compact<BlockNumber>]> {
    const block = await api.rpc.chain.getBlock();
    const blockNumber = block.block.header.number;
    const blockNumberBytes = blockNumber.toBn().toBuffer("le");

    const hashed = await hash.blake2b(blockNumberBytes, 256);
    return [hexToU8a(`0x${hashed}`), blockNumber];
  }

  constructor(private api: ApiPromise) {}

  async #getDeviceId(credentialId: Uint8Array): Promise<`0x${string}`> {
    const hashed = await hash.blake2b(credentialId, 256);

    return `0x${hashed}`;
  }

  async register(
    blockNumber: Compact<BlockNumber>,
    hashedUserId: Uint8Array,
    credentialId: Uint8Array,
    authenticatorData: Uint8Array,
    clientData: Uint8Array,
    publicKey: Uint8Array
  ): Promise<SubmittableExtrinsic<"promise">> {
    const attestation = this.api.createType(
      "PassWebauthnAttestation",
      new Attestation(blockNumber, await this.#getDeviceId(credentialId), {
        authenticatorData,
        clientData,
        publicKey,
      })
    );

    return this.api.tx.pass.register(hashedUserId, { WebAuthn: attestation });
  }
}
