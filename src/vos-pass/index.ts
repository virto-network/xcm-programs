import "@polkadot/api-augment/kusama";

import * as hash from "hash-wasm";

import { BlockNumber, Compact } from "../types";

import { ApiPromise } from "@polkadot/api";
import { Assertion } from "./assertion";
import { Attestation } from "./attestation";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { hexToU8a } from "@polkadot/util";
import { HexString } from "@polkadot/util-crypto/helpers";

/**
 *
 */
export class Pass {
  static async generateChallenge(
    api: ApiPromise
  ): Promise<[Uint8Array, Compact<BlockNumber>]> {
    const block = await api.rpc.chain.getBlock();
    const blockNumber = block.block.header.number;
    const blockNumberBytes = blockNumber.toBn().toArray("le");

    const hashed = await hash.blake2b(new Uint8Array(blockNumberBytes), 256);
    return [hexToU8a(`0x${hashed}`), blockNumber];
  }

  constructor(private api: ApiPromise) { }

  async #getDeviceId(credentialId: Uint8Array): Promise<Uint8Array> {
    const hashed = await hash.blake2b(credentialId, 256);
    return hexToU8a(`0x${hashed}`);
  }

  async register(
    blockNumber: Compact<BlockNumber>,
    hashedUserId: Uint8Array,
    credentialId: Uint8Array,
    authenticatorData: Uint8Array,
    clientData: Uint8Array,
    publicKey: Uint8Array
  ): Promise<[SubmittableExtrinsic<"promise">, String]> {
    const attestation = this.api.createType(
      "PassWebauthnAttestation",
      new Attestation({
        meta: {
          context: blockNumber,
          deviceId: await this.#getDeviceId(credentialId),
        },
        authenticatorData,
        clientData,
        publicKey,
      })
    );

    return [this.api.tx.pass.register(hashedUserId, { WebAuthn: attestation }), this.api.tx.pass.register(hashedUserId, { WebAuthn: attestation }).toHex()];
  }

  async authenticate(
    blockNumber: Compact<BlockNumber>,
    hashedUserId: Uint8Array,
    credentialId: Uint8Array,
    authenticatorData: Uint8Array,
    clientData: Uint8Array,
    signature: Uint8Array
  ): Promise<SubmittableExtrinsic<"promise">> {
    const assertion = new Assertion({
      meta: {
        context: blockNumber,
        userId: hashedUserId,
      },
      authenticatorData,
      clientData,
      signature,
    });

    return this.api.tx.pass.authenticate(
      await this.#getDeviceId(credentialId),
      {
        WebAuthn: assertion,
      },
      null
    );
  }
}
