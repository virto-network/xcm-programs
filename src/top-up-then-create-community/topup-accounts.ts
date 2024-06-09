import { ApiPromise } from "@polkadot/api";
import { location, fungibleAsset } from "../common";
import { sovereignAccountForCommunityInSibling } from "../utils/community-account-ids";

export async function topupSignerAccountInKreivo(
  api: ApiPromise,
  signerAddress: string,
  amount: number
) {
  // 1a. Transfers amount to signer address in Kreivo.
  // This is to cover creating the community, and fees.
  const transferToKreivo = {
    TransferReserveAsset: {
      assets: [fungibleAsset(location`./Here`, amount)],
      dest: location`./Parachain(2281)`,
      xcm: [
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, amount),
            weightLimit: "Unlimited",
          },
        },
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            beneficiary: location`./AccountId32(${signerAddress})`,
          },
        },
      ],
    },
  };

  return api.createType("StagingXcmV4Instruction", transferToKreivo);
}

export async function topupCommunityAccountInKreivo(
  api: ApiPromise,
  communityId: number,
  amount
) {
  // 1b. Transfer amount to Community in Kreivo.
  // This is to support buying memberships.
  const transferToKreivo = api.createType("StagingXcmV4Instruction", {
    TransferReserveAsset: {
      assets: [fungibleAsset(location`./Here`, amount)],
      dest: location`./Parachain(2281)`,
      xcm: [
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, amount),
            weightLimit: "Unlimited",
          },
        },
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            beneficiary: location`./Plurality(Index(${communityId}),Voice)`,
          },
        },
      ],
    },
  });

  return transferToKreivo;
}

export async function topupCommunityAccountInPeople(
  api: ApiPromise,
  communityId: number,
  amount: number
) {
  // 1c. Transfer amount to People Chain.
  // This is to support the setting of identities
  const teleportToPeople = api.createType("StagingXcmV4Instruction", {
    InitiateTeleport: {
      assets: {
        Definite: [fungibleAsset(location`./Here`, amount)],
      },
      dest: location`./Parachain(1004)`,
      xcm: [
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, amount),
            weightLimit: "Unlimited",
          },
        },
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            beneficiary: location`./AccountId32(${await sovereignAccountForCommunityInSibling(
              api,
              communityId
            )})`,
          },
        },
      ],
    },
  });

  return teleportToPeople;
}
