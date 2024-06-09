import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";
import { Identity } from "../types";
import {
  communityAccountInKreivo,
  sovereignAccountForCommunityInRelay,
} from "../utils/community-account-ids";
import { concreteIdfungibleAsset, fungibleAsset, location } from "../common";

function encodeableIdentity(identity: Identity) {
  return Object.entries(identity).reduce(
    (o, [key, value]) => ({
      ...o,
      [key]: value !== undefined || value !== null ? { Raw: value } : "None",
    }),
    {} as Record<string, { Raw: string } | "None">
  );
}

async function setIdentityTransact(
  kreivoApi: ApiPromise,
  peopleApi: ApiPromise,
  identity: Identity
) {
  const { method } = peopleApi.tx.identity.setIdentity(
    encodeableIdentity(identity)
  );
  const dispatchInfo =
    await peopleApi.call.transactionPaymentCallApi.queryCallInfo(
      method.toU8a(),
      method.toU8a().length
    );

  return kreivoApi.createType("XcmV3Instruction", {
    Transact: {
      originKind: "SovereignAccount",
      requireWeightAtMost: dispatchInfo.weight,
      call: {
        encoded: method.toHex(),
      },
    },
  });
}

async function addSubTransact(
  kreivoApi: ApiPromise,
  peopleApi: ApiPromise,
  sub: string,
  name: string
) {
  const { method } = peopleApi.tx.identity.addSub(sub, { Raw: name });
  const dispatchInfo =
    await peopleApi.call.transactionPaymentCallApi.queryCallInfo(
      method.toU8a(),
      method.toU8a().length
    );

  return kreivoApi.createType("XcmV3Instruction", {
    Transact: {
      originKind: "SovereignAccount",
      requireWeightAtMost: dispatchInfo.weight,
      call: {
        encoded: method.toHex(),
      },
    },
  });
}

export async function setIdentityThenAddSubsSendTransact(
  kusamaApi: ApiPromise,
  kreivoApi: ApiPromise,
  peopleApi: ApiPromise,
  communityId: number,
  identity: Identity
) {
  const relayCommunityAccount = await sovereignAccountForCommunityInRelay(
    kreivoApi,
    communityId
  );
  const localCommunityAccount = await communityAccountInKreivo(
    kreivoApi,
    communityId
  );

  const { method } = kreivoApi.tx.communities.dispatchAsAccount(
    kreivoApi.tx.polkadotXcm.send(
      {
        V3: kreivoApi.createType("StagingXcmV3MultiLocation", {
          parents: 1,
          interior: { X1: { Parachain: 1004 } },
        }),
      },
      {
        V3: [
          {
            WithdrawAsset: [concreteIdfungibleAsset(location`../Here`, 1e9)],
          },
          {
            BuyExecution: {
              fees: concreteIdfungibleAsset(location`../Here`, 1e9),
              weightLimit: "Unlimited",
            },
          },
          await setIdentityTransact(kreivoApi, peopleApi, identity),
          { ExpectTransactStatus: "Success" },
          await addSubTransact(
            kreivoApi,
            peopleApi,
            relayCommunityAccount,
            "Sovereign Account in Kusama"
          ),
          { ExpectTransactStatus: "Success" },
          await addSubTransact(
            kreivoApi,
            peopleApi,
            localCommunityAccount,
            "Community Account in Kreivo"
          ),
          { ExpectTransactStatus: "Success" },
          "RefundSurplus",
          {
            DepositAsset: {
              assets: { Wild: "All" },
              beneficiary: location`../Parachain(2281)/Plurality(Index(${communityId}),Voice)`,
            },
          },
        ],
      }
    )
  );
  const dispatchInfo =
    await kreivoApi.call.transactionPaymentCallApi.queryCallInfo(
      method.toU8a(),
      method.toU8a().length
    );

  return kusamaApi.createType("StagingXcmV4Instruction", {
    Transact: {
      originKind: "SovereignAccount",
      requireWeightAtMost: dispatchInfo.weight,
      call: {
        encoded: method.toHex(),
      },
    },
  });
}
