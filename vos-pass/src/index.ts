import "@polkadot/api-augment/kusama";

import * as hash from "hash-wasm";

import { BlockNumber, Compact } from "./types";
import { hexToU8a, u8aToHex } from "@polkadot/util";

import { ApiPromise } from "@polkadot/api";
import { Assertion } from "./assertion";
import { Attestation } from "./attestation";
import { SubmittableExtrinsic } from "@polkadot/api/types";

function strArray(str: string, size: number): Uint8Array {
  return new Uint8Array(
    str
      .split("")
      .map((x) => x.charCodeAt(0))
      .concat(new Array(size - str.length).fill(0))
  );
}

/**
 *
 */
export class Pass {
  static async generateChallenge(
    api: ApiPromise
  ): Promise<[Uint8Array, Compact<BlockNumber>]> {
    const {
      block: { header },
    } = await api.rpc.chain.getBlock();
    return [header.hash, header.number];
  }

  constructor(private api: ApiPromise) {}

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
          authorityId: u8aToHex(strArray("kreivo_p", 32)),
          context: blockNumber,
          deviceId: await this.#getDeviceId(credentialId),
        },
        authenticatorData,
        clientData,
        publicKey,
      })
    );

    return [
      this.api.tx.pass.register(hashedUserId, { WebAuthn: attestation }),
      this.api.tx.pass
        .register(hashedUserId, { WebAuthn: attestation })
        .toHex(),
    ];
  }

  async authenticate(
    blockNumber: Compact<BlockNumber>,
    hashedUserId: Uint8Array,
    credentialId: Uint8Array,
    authenticatorData: Uint8Array,
    clientData: Uint8Array,
    signature: Uint8Array
  ): Promise<[SubmittableExtrinsic<"promise">, String]> {
    const assertion = new Assertion({
      meta: {
        authorityId: u8aToHex(strArray("kreivo_p", 32)),
        context: blockNumber,
        userId: hashedUserId,
      },
      authenticatorData,
      clientData,
      signature,
    });

    return [
      this.api.tx.pass.authenticate(
        await this.#getDeviceId(credentialId),
        {
          WebAuthn: assertion,
        },
        null
      ),
      this.api.tx.pass
        .authenticate(
          await this.#getDeviceId(credentialId),
          {
            WebAuthn: assertion,
          },
          null
        )
        .toHex(),
    ];
  }
}
