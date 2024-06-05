import { ApiPromise } from "@polkadot/api";
import { location, fungibleAsset } from "../common";
import { sovereignAccountForCommunityInSibling } from "../utils/community-account-ids";

export async function topupSignerAccountInKreivo(
  api: ApiPromise,
  signerAddress: string
) {
  // 1a. Transfers 0.51KSM (because fees) to Kreivo
  const transferToKreivo = {
    TransferReserveAsset: {
      assets: [fungibleAsset(location`./Here`, 0.51e12)],
      dest: location`./Parachain(2281)`,
      xcm: [
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, 0.51e12),
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

export async function topupCommunityAccountInPeople(
  api: ApiPromise,
  communityId: number
) {
  // 1b. Transfer 0.41KSM (because fees) to People Chain.
  // This is to support the setting of identities
  const teleportToPeople = api.createType("StagingXcmV4Instruction", {
    InitiateTeleport: {
      assets: {
        Definite: [fungibleAsset(location`./Here`, 0.41e12)],
      },
      dest: location`./Parachain(1004)`,
      xcm: [
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, 0.41e12),
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
