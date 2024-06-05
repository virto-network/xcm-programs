import { ApiPromise } from "@polkadot/api";
import { DecisionMethod, Identity } from "../types";
import { decodeAddress } from "@polkadot/util-crypto";

function getDecisionMethod(decisionMethod?: DecisionMethod) {
  let encodedDecisionMethod: unknown = {
    Membership: null,
  };
  switch (decisionMethod?.type) {
    case "Rank":
      encodedDecisionMethod = {
        Rank: null,
      };
      break;
    case "NativeToken":
      encodedDecisionMethod = {
        NativeToken: null,
      };
      break;
    case "CommunityAsset":
      encodedDecisionMethod = {
        CommunityAsset: [decisionMethod.id, decisionMethod.minVote],
      };
      break;
  }

  return encodedDecisionMethod;
}

export async function createCommunityTransact(
  kusamaApi: ApiPromise,
  kreivoApi: ApiPromise,
  signerAddress: string,
  communityId: number,
  name: string,
  decisionMethod?: DecisionMethod
) {
  const encodedDecisionMethod = getDecisionMethod(decisionMethod);

  // Part 2: Create Community, then set identities
  const createCommunity = kreivoApi.tx.communitiesManager.register(
    communityId,
    name,
    {
      Id: decodeAddress(signerAddress),
    },
    encodedDecisionMethod,
    null
  );

  const createCommunityDispatchInfo =
    await kreivoApi.call.transactionPaymentCallApi.queryCallInfo(
      createCommunity.method,
      createCommunity.method.toU8a().length
    );

  return kusamaApi.createType("StagingXcmV4Instruction", {
    Transact: {
      originKind: "SovereignAccount",
      requireWeightAtMost: createCommunityDispatchInfo.weight,
      call: {
        encoded: createCommunity.method.toHex(),
      },
    },
  });
}
