import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";

import { location, fungibleAsset } from "../common";
import { Signer } from "@polkadot/api/types";
import {
  topupCommunityAccountInKreivo,
  topupCommunityAccountInPeople,
  topupSignerAccountInKreivo,
} from "./topup-accounts";
import { AccountId, DecisionMethod, Identity, Topup } from "../types";
import { createCommunityTransact } from "./create-community";
import { setIdentityThenAddSubsSendTransact } from "./set-identity";
import { acquireMembershipsAndAddMembers } from "./acquire-memberships-invite-members";

export async function topupThenCreateCommunity(
  // Injected parameters
  providers: Record<string, WsProvider>,
  address: string,
  signer: Signer,
  // Provided
  communityId: number,
  name: string,
  decisionMethod: DecisionMethod = { type: "Membership" },
  identity?: Identity,
  membershipAccounts: AccountId[] = [],
  topup: Topup = {
    signerInKreivo: 0.51e12,
    communityAccountInKreivo: 1e9 + 0.3e12 * membershipAccounts.length,
    communityAccountInPeople: identity ? 0.11e12 : 0,
  }
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
          WithdrawAsset: [
            fungibleAsset(
              location`./Here`,
              topup.signerInKreivo +
                topup.communityAccountInKreivo +
                topup.communityAccountInPeople +
                5e8
            ),
          ],
        },
        {
          BuyExecution: {
            fees: fungibleAsset(location`./Here`, 5e8),
          },
        },
        ...(topup.signerInKreivo
          ? [
              await topupSignerAccountInKreivo(
                kusamaApi,
                address,
                topup.signerInKreivo
              ),
            ]
          : []),
        ...(topup.communityAccountInKreivo
          ? [
              await topupCommunityAccountInKreivo(
                kusamaApi,
                communityId,
                topup.communityAccountInKreivo
              ),
            ]
          : []),
        ...(topup.communityAccountInPeople
          ? [
              await topupCommunityAccountInPeople(
                kusamaApi,
                communityId,
                topup.communityAccountInPeople
              ),
            ]
          : []),
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
        ...(membershipAccounts.length > 0
          ? [
              await acquireMembershipsAndAddMembers(
                kusamaApi,
                kreivoApi,
                membershipAccounts
              ),
              {
                ExpectTransactStatus: "Success",
              },
            ]
          : []),
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
