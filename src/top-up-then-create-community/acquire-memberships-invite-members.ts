// Warning: (not very) best effort here.
// This script reads some memberships in sale from the storage, then buys and assignd.
// This fails if there are not enough memberships. However, we can't still propagate such errors.

import "@polkadot/api-augment/substrate";
import { ApiPromise } from "@polkadot/api";
import { AccountId } from "../types";
import { u128 } from "@polkadot/types";

async function prepareMemberships(
  api: ApiPromise,
  membershipAccounts: AccountId[]
) {
  const itemsForSale =
    await api.query.communityMemberships.itemPriceOf.entriesPaged({
      args: [0],
      pageSize: membershipAccounts.length,
    });

  return itemsForSale.map(([key, value], i) => {
    const itemKey = (key.toHuman() as unknown as string[])[1];
    const preItem = (key.toHuman() as unknown as string[])[1].replaceAll(
      /\D/g,
      ""
    );
    const item = Number(preItem);
    console.log(itemKey, preItem, item);

    return {
      item,
      price: (value as unknown as { unwrap: () => [u128, string] })
        .unwrap()[0]
        .toNumber(),
      accountToAssign: membershipAccounts[i],
    };
  });
}

export async function acquireMembershipsAndAddMembers(
  kusamaApi: ApiPromise,
  kreivoApi: ApiPromise,
  membershipAccounts: AccountId[]
) {
  const membershipsToAcquire = await prepareMemberships(
    kreivoApi,
    membershipAccounts
  );

  const { method } = kreivoApi.tx.communities.dispatchAsAccount(
    kreivoApi.tx.utility.batch(
      membershipsToAcquire.flatMap((m) => [
        kreivoApi.tx.communityMemberships.buyItem(0, m.item, m.price),
        kreivoApi.tx.communities.addMember(m.accountToAssign),
      ])
    )
  );

  const dispatchInfo =
    await kreivoApi.call.transactionPaymentCallApi.queryCallInfo(
      method,
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
