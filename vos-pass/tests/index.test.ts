// deno-lint-ignore-file no-explicit-any
import { ApiPromise, Keyring } from "@polkadot/api";
import type {
  ChainId,
  ClientCreateOptions,
  Network,
} from "npm:@virtonetwork/kreivo-sandbox@1.3.1";
import {
  RuntimeLogLevel,
  SandboxClient,
} from "npm:@virtonetwork/kreivo-sandbox@1.3.1";
import { afterAll, beforeAll, describe, it } from "jsr:@std/testing/bdd";
import { eventPartiallyMatches, signSendAndWait } from "./helpers.ts";

import { Pass } from "../src/index.ts";
import { WebAuthnEmulator } from "jsr:@wok/webauthn-emulator";
import { expect } from "jsr:@std/expect";
import { setStorage } from "npm:@acala-network/chopsticks";

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
    runtimeLogLevel: RuntimeLogLevel.Trace,
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
  let kreivoApi: ApiPromise;
  let hashedUserId: Uint8Array;

  // Define the WebAuthn emulator
  const emulator = new WebAuthnEmulator();
  const ORIGIN = "https://kreivo_p.example.com";

  beforeAll(async () => {
    sandboxClient = await setupSandboxClient();
    const kreivoChain = sandboxClient.chains.find(
      ({ name }) => name === "kreivo"
    )!;

    const ALICE = KEYRING.addFromUri("//Alice");
    await setStorage(kreivoChain.client.blockchain, {
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

    kreivoApi = kreivoChain.client.api as unknown as ApiPromise;

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
        name: "testuser",
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
            name: user.name,
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

      console.log("On Block:", blockNumber.toNumber());
      console.log(attestationResponse);

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
      console.log("Call Hex:", tx.method.toHex());

      const ALICE = KEYRING.addFromUri("//Alice");
      const result = await signSendAndWait(tx, ALICE);

      expect((result.toHuman() as any).events).toContainEqual({
        event: {
          method: "Registered",
          section: "pass",
        },
      });
      expect((result.toHuman() as any).events).toContainEqual({
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

      console.log("On Block:", blockNumber.toNumber());
      console.log(assertionResponse);

      const tx = await pass.authenticate(
        blockNumber,
        hashedUserId,
        new Uint8Array(assertionResponse.rawId),
        new Uint8Array(assertionResponse.response.authenticatorData),
        new Uint8Array(assertionResponse.response.clientDataJSON),
        new Uint8Array(assertionResponse.response.signature)
      );
      console.log("Call Hex:", tx.method.toHex());

      const BOB = KEYRING.addFromUri("//Alice");
      const result = await signSendAndWait(tx, BOB);

      console.log(result.toHuman());

      expect(result.events).toContainEqual({
        event: {
          section: "pass",
          method: "SessionCreated",
        },
      });
    });
  });

  afterAll(async () => {
    for (const chain of sandboxClient.chains) {
      await chain.client.close();
    }
  });
});
