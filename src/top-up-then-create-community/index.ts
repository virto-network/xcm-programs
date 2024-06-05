import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";

import { location, fungibleAsset } from "../common";
import { Signer } from "@polkadot/api/types";
import {
  topupCommunityAccountInPeople,
  topupSignerAccountInKreivo,
} from "./topup-accounts";
import { DecisionMethod, Identity } from "../types";
import { createCommunityTransact } from "./create-community";
import { setIdentityThenAddSubsSendTransact } from "./set-identity";

export async function topupThenCreateCommunity(
  // Injected parameters
  providers: Record<string, WsProvider>,
  address: string,
  signer: Signer,
  // Provided
  communityId: number,
  name: string,
  decisionMethod: DecisionMethod = { type: "Membership" },
  identity?: Identity
) {
  const kusamaApi = await ApiPromise.create({
    provider: providers.kusama,
  });
  const kreivoApi = await ApiPromise.create({
    provider: providers.kreivo,
  });
  const peopleApi = await ApiPromise.create({
    provider: providers.kusamaPeople,
  });

  // Part 1: Transfer assets
  const transferAssetsExecution = kusamaApi.tx.xcmPallet.execute(
    {
      V4: [
        {
          WithdrawAsset: [fungibleAsset(location`./Here`, 1e12)],
        },
        {
          BuyExecution: {
            fees: fungibleAsset(location`./Here`, 5e8),
          },
        },
        await topupSignerAccountInKreivo(kusamaApi, address),
        await topupCommunityAccountInPeople(kusamaApi, communityId),
        {
          RefundSurplus: null,
        },
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            beneficiary: location`./AccountId32(${address})`,
          },
        },
      ],
    },
    {
      refTime: kusamaApi.createType("Compact<u64>", 1e10),
      proofSize: kusamaApi.createType("Compact<u64>", 1e8),
    }
  );

  // Part 2: Create Community and Set Identities
  const createCommunitySend = kusamaApi.tx.xcmPallet.send(
    {
      V4: location`./Parachain(2281)`,
    },
    {
      V4: [
        {
          WithdrawAsset: [fungibleAsset(location`../Here`, 9e9)],
        },
        {
          BuyExecution: {
            fees: fungibleAsset(location`../Here`, 9e9),
            weightLimit: "Unlimited",
          },
        },
        await createCommunityTransact(
          kusamaApi,
          kreivoApi,
          address,
          communityId,
          name,
          decisionMethod
        ),
        {
          ExpectTransactStatus: "Success",
        },
        ...(identity !== undefined
          ? [
              await setIdentityThenAddSubsSendTransact(
                kusamaApi,
                kreivoApi,
                peopleApi,
                communityId,
                identity
              ),
              {
                ExpectTransactStatus: "Success",
              },
            ]
          : []),
        "RefundSurplus",
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            beneficiary: location`./AccountId32(${address})`,
          },
        },
      ],
    }
  );

  return kusamaApi.tx.utility
    .batch([transferAssetsExecution, createCommunitySend])
    .signAndSend(address, { signer }, () => console.log("sign"));
}
