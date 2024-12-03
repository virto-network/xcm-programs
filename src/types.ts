import { WsProvider } from "@polkadot/api";
import { Signer } from "@polkadot/api/types";

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


export type AccountId = string;
export type MembershipId = string;
export type PollIndex = string;

export type AccountMembership = {
  accountId: AccountId,
  membershipId: MembershipId
}

export type TreasuryPeriod = {
  blocks: number | null,
  amount: number,
}

export enum Conviction {
  None,
  Locked1x,
  Locked2x,
  Locked3x,
  Locked4x,
  Locked5x,
  Locked6x,
}

export type Vote =
  | {
    type: "Standard";
    aye: boolean;
    conviction: Conviction;
    balance: number;
  }
  | {
    type: "Split";
    aye: number;
    nay: number;
  }
  | {
    type: "SplitAbstain";
    aye: number;
    nay: number;
    abstain: number;
  };

export type VoteOpenGov = {
  pollIndex: number,
  vote: Vote
}

export type CommunityTransfer = {
  account: AccountId,
  value: number
}

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
