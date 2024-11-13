import { ApiPromise, Keyring } from "@polkadot/api";
import type {
  ChainId,
  ClientCreateOptions,
  Network,
} from "npm:@virtonetwork/kreivo-sandbox@1.2.5";
import {
  RuntimeLogLevel,
  SandboxClient,
} from "npm:@virtonetwork/kreivo-sandbox@1.2.5";
import { afterAll, beforeAll, describe, it } from "jsr:@std/testing/bdd";

import { Pass } from "../src/index.ts";
import { WebAuthnEmulator } from "npm:nid-webauthn-emulator";
import { expect } from "jsr:@std/expect";
import { setStorage } from "npm:@acala-network/chopsticks";

const opts: Omit<Deno.TestDefinition, "name" | "fn"> = {
  sanitizeOps: false,
  sanitizeResources: false,
};

const KEYRING = new Keyring({ ss58Format: 2 });

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
    runtimeLogLevel: RuntimeLogLevel.Info,
    wasmOverrides: {} as unknown as Record<ChainId, string>,
  } as ClientCreateOptions);

  await sandbox.initialize();

  return sandbox;
}

describe("Pass", opts, () => {
  let sandboxClient: SandboxClient;
  let kreivoApi: ApiPromise;

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
  });

  describe("#register", () => {
    it("Correctly registers a new account", async () => {
      const [challenge, blockNumber] = await Pass.generateChallenge(kreivoApi);

      // Initialize the WebAuthn emulator
      const emulator = new WebAuthnEmulator();

      // Define origin and user information
      const origin = "https://kreivo_p.example.com";
      const user = {
        id: "user-id-123",
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
            id: new TextEncoder().encode(user.id),
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
      const attestationResponse = emulator.create(origin, attestationOptions);
      expect(attestationResponse.response.getPublicKey()).toHaveLength(91);

      // Register pass

      // deno-lint-ignore no-explicit-any
      const pass = new Pass(kreivoApi as any);

      const tx = await pass.register(
        blockNumber,
        // Note: use SHA-256 for practical reasons. In practice, the `HashedUserId` must be an obscure
        // `[u8; 32]` array, regardless of how it was produced.
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode("user@example.com")
          )
        ),
        attestationResponse.toJSON().rawId as unknown as Uint8Array,
        attestationResponse.response.getAuthenticatorData(),
        attestationResponse.response.clientDataJSON,
        attestationResponse.response.getPublicKey()
      );

      const ALICE = KEYRING.addFromUri("//Alice");
      const result = await new Promise((resolve, reject) =>
        tx.signAndSend(ALICE, (result) => {
          switch (true) {
            case result.isError:
              return reject(result.status);
            case result.isInBlock:
              return resolve(result.toHuman());
            case result.isWarning:
              console.warn(result.toHuman(true));
          }
        })
      );

      console.log(result);
    });
  });

  afterAll(async () => {
    for (const chain of sandboxClient.chains) {
      await chain.client.close();
    }
  });
});
