import { ApiPromise, Keyring } from "@polkadot/api";
import { Blockchain, setStorage } from "npm:@acala-network/chopsticks";
import type {
  ChainId,
  ClientCreateOptions,
  Network,
} from "npm:@virtonetwork/kreivo-sandbox@1.3.1";
import {
  RuntimeLogLevel,
  SandboxClient,
} from "npm:@virtonetwork/kreivo-sandbox@1.3.1";
import { Vec, u8 } from "@polkadot/types";
import { afterAll, beforeAll, describe, it } from "jsr:@std/testing/bdd";
import { eventPartiallyMatches, signSendAndWait } from "./helpers.ts";

import { Pass } from "../src/index.ts";
import { WebAuthnEmulator } from "jsr:@wok/webauthn-emulator";
import { expect } from "jsr:@std/expect";

const opts: Omit<Deno.TestDefinition, "name" | "fn"> = {
  sanitizeOps: false,
  sanitizeResources: false,
};

const KEYRING = new Keyring({ ss58Format: 2 });

expect.addEqualityTesters([eventPartiallyMatches]);

/**
 * Sets-up the testing API client.
 */
async function setupSandboxClient() {
  class PaseoNetwork implements Network {
    getEndpoint(chainId: ChainId): string | string[] {
      return PaseoNetwork.endpoints[chainId] as string | string[];
    }

    static endpoints: Partial<Record<ChainId, string | string[]>> = {
      kreivo: "wss://testnet.virto.dev",
    };
  }

  const sandbox = new SandboxClient({
    network: new PaseoNetwork(),
    withRelay: false,
    withUpgrade: false,
    withSiblings: [],
    runtimeLogLevel: RuntimeLogLevel.Off,
    ...(Deno.env.get("TEST_WASM_OVERRIDE")
      ? {
          wasmOverrides: {
            kreivo: Deno.env.get("TEST_WASM_OVERRIDE"),
          } as Record<ChainId, string>,
        }
      : {}),
  } as ClientCreateOptions);

  await sandbox.initialize();

  return sandbox;
}

describe("Pass", opts, () => {
  // Define the sandbox
  let sandboxClient: SandboxClient;
  let kreivoChain: Blockchain;
  let kreivoApi: ApiPromise;
  let hashedUserId: Uint8Array;

  // Define the WebAuthn emulator
  const emulator = new WebAuthnEmulator();
  const ORIGIN = "https://kreivo_p.example.com";
  let accountKey: string;

  beforeAll(async () => {
    sandboxClient = await setupSandboxClient();
    const kreivoClient = sandboxClient.chains.find(
      ({ name }) => name === "kreivo"
    )!;

    kreivoChain = kreivoClient.client.blockchain;

    const ALICE = KEYRING.addFromUri("//Alice");
    await setStorage(kreivoChain, {
      System: {
        Account: [
          [
            [ALICE.address],
            {
              nonce: 0,
              consumers: 0,
              providers: 1,
              sufficients: 0,
              data: {
                free: 10_000000000000,
                reserved: 0,
                frozen: 0,
                flags: 0,
              },
            },
          ],
        ],
      },
    });

    kreivoApi = kreivoClient.client.api as unknown as ApiPromise;

    // Note: use SHA-256 for practical reasons. In practice, the `HashedUserId` must be an obscure
    // `[u8; 32]` array, regardless of how it was produced.
    hashedUserId = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("testuser@example.com")
      )
    );
  });

  describe("#register", () => {
    it("Correctly registers a new account", async () => {
      const [challenge, blockNumber] = await Pass.generateChallenge(kreivoApi);

      // Define origin and user information
      const user = {
        id: hashedUserId,
        displayName: "Test User",
      };

      // Define attestation options
      const attestationOptions = {
        publicKey: {
          rp: {
            name: "Example RP",
          },
          user: {
            id: user.id,
            displayName: user.displayName,
          },
          challenge,
          pubKeyCredParams: [
            {
              type: "public-key",
              alg: -7, // ES256 algorithm
            },
          ],
          authenticatorSelection: {
            userVerification: "preferred",
          },
          timeout: 60_000,
          attestation: "none",
        },
      };

      // Generate attestation response
      const attestationResponse = emulator.create(ORIGIN, attestationOptions);
      expect(attestationResponse.response.getPublicKey()).toHaveLength(91);

      // Register pass
      const pass = new Pass(kreivoApi);

      const tx = await pass.register(
        blockNumber,
        hashedUserId,
        new Uint8Array(attestationResponse.rawId),
        new Uint8Array(attestationResponse.response.getAuthenticatorData()),
        new Uint8Array(attestationResponse.response.clientDataJSON),
        new Uint8Array(attestationResponse.response.getPublicKey()!)
      );

      const ALICE = KEYRING.addFromUri("//Alice");
      const result = await signSendAndWait(tx, ALICE);

      // Verification
      expect(result.events).toContainEqual({
        event: {
          method: "Registered",
          section: "pass",
        },
      });

      const { event: registeredEvent } = result.events.find(
        (record) => record.event.method === "Registered"
      )!;

      accountKey = KEYRING.encodeAddress(
        (registeredEvent.data as unknown as Record<string, Vec<u8>>).who.toU8a()
      );

      expect(result.events).toContainEqual({
        event: {
          method: "AddedDevice",
          section: "pass",
        },
      });
    });
  });

  describe("#authenticate", () => {
    it("Correctly authenticates onto an existing account", async () => {
      const [challenge, blockNumber] = await Pass.generateChallenge(kreivoApi);

      // Define attestation options
      const assertionOptions = {
        publicKey: {
          challenge,
          userVerification: "preferred",
          timeout: 60_000,
        },
      };

      // Generate attestation response
      const assertionResponse = emulator.get(ORIGIN, assertionOptions);
      expect(assertionResponse.response.signature).toBeTruthy();

      // Authenticate pass
      const pass = new Pass(kreivoApi);

      const tx = await pass.authenticate(
        blockNumber,
        hashedUserId,
        new Uint8Array(assertionResponse.rawId),
        new Uint8Array(assertionResponse.response.authenticatorData),
        new Uint8Array(assertionResponse.response.clientDataJSON),
        new Uint8Array(assertionResponse.response.signature)
      );

      const SESSION_KEY = KEYRING.addFromUri("//Bob");
      const result = await signSendAndWait(tx, SESSION_KEY);

      // Verification
      expect(result.events).toContainEqual({
        event: {
          section: "pass",
          method: "SessionCreated",
          data: {
            sessionKey: SESSION_KEY.address,
          },
        },
      });
    });
  });

  describe("#dispatch", () => {
    it("Dispatching works, assuming the pass account is funded and can pay fees", async () => {
      await setStorage(kreivoChain, {
        System: {
          Account: [
            [
              [accountKey],
              {
                data: {
                  free: 1e13,
                },
              },
            ],
          ],
        },
      });

      // We'll use the previously used session key.
      const SESSION_KEY = KEYRING.addFromUri("//Bob");
      const SESSION_KEY_FREE_AMOUNT = await kreivoApi.query.system.account(
        SESSION_KEY.address
      );

      const PASS_ACCOUNT_FREE_AMOUNT = await kreivoApi.query.system.account(
        accountKey
      );

      // We're going to submit an on-chain remark that should raise an event.
      const tx = kreivoApi.tx.pass.dispatch(
        kreivoApi.tx.system.remarkWithEvent("Hello, world!"),
        null,
        null
      );

      const result = await signSendAndWait(tx, SESSION_KEY);

      expect(result.events).toContainEqual({
        event: {
          section: "system",
          method: "Remarked",
          data: {
            sender: accountKey,
          },
        },
      });

      const SESSION_KEY_FREE_AMOUNT_NOW = await kreivoApi.query.system.account(
        SESSION_KEY.address
      );
      expect(SESSION_KEY_FREE_AMOUNT_NOW.data.free.toBigInt()).toEqual(
        SESSION_KEY_FREE_AMOUNT.data.free.toBigInt()
      );

      const PASS_ACCOUNT_FREE_AMOUNT_NOW = await kreivoApi.query.system.account(
        SESSION_KEY.address
      );
      expect(PASS_ACCOUNT_FREE_AMOUNT_NOW.data.free.toNumber()).toBeLessThan(
        PASS_ACCOUNT_FREE_AMOUNT.data.free.toNumber()
      );
    });

    // TODO: Try dispatching, assuming an account has a membership that can cover for fees.

    // kreivoApi.registerTypes({
    //   BlockNumber: "u32",
    //   Weight: "SpWeightsWeightV2Weight",
    //   GasTank: {
    //     since: "BlockNumber",
    //     used: "Weight",
    //     period: "Option<BlockNumber>",
    //     maxPerPeriod: "Option<Weight>",
    //   },
    // });

    // await setStorage(kreivoChain, {
    //   CommunityMemberships: {
    //     Attribute: [
    //       [
    //         [1, 0, "Pallet", "Xmembership_gas"],
    //         [
    //           kreivoApi
    //             .createType("GasTank", {
    //               since: 0,
    //               used: {
    //                 refTime: 0,
    //                 proofSize: 0,
    //               },
    //               period: null, // Yup, this is unlimited
    //               maxPerPeriod: null, // Yup, this is unlimited
    //             })
    //             .toHex(),
    //           {
    //             account: null,
    //             amount: 0,
    //           },
    //         ],
    //       ],
    //     ],
    //     Item: [
    //       [
    //         [1, 0],
    //         {
    //           owner: accountKey,
    //           approvals: {},
    //           deposit: {
    //             account: "F3opxRbN5ZbjJNU511Kj2TLuzFcDq9BGduA9TgiECafpg29",
    //             amount: 0,
    //           },
    //         },
    //       ],
    //     ],
    //   },
    // });
  });

  afterAll(async () => {
    for (const chain of sandboxClient.chains) {
      await chain.client.close();
    }
  });
});
