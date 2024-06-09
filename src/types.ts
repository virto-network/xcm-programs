import { WsProvider } from "@polkadot/api";
import { Signer } from "@polkadot/api/types";

export type AccountId = string;

export type ExecutableFunctionOf<T> = (
  providers: Record<string, WsProvider>,
  address: string,
  signer: Signer,
  ...params: any[]
) => Promise<T>;

export type DecisionMethod =
  | {
      type: "Membership";
    }
  | {
      type: "Rank";
    }
  | {
      type: "NativeToken";
    }
  | {
      type: "CommunityAsset";
      id: any;
      minVote: number;
    };

export type Identity = {
  display: string;
  legal?: string;
  web?: string;
  matrix?: string;
  email?: string;
  pgpFingerprint?: Uint8Array;
  image?: string;
  twitter?: string;
  github?: string;
  discord?: string;
};

export type Topup = {
  signerInKreivo: number;
  communityAccountInKreivo: number;
  communityAccountInPeople: number;
};
