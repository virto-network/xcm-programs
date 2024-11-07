// Warning: (not very) best effort here.
// This script reads some memberships in sale from the storage, then buys and assignd.
// This fails if there are not enough memberships. However, we can't still propagate such errors.

import "@polkadot/api-augment/substrate";
import { ApiPromise } from "@polkadot/api";
import { AccountId } from "../types";
import { Option, u128 } from "@polkadot/types";

type MembershipItemQuote = {
  item: number;
  price: number;
  buyer?: Option<any>;
  accountToAssign: string;
}

async function prepareMemberships(
  api: ApiPromise,
  membershipAccounts: AccountId[]
) {
  const itemsForSale =
    await api.query.communityMemberships.itemPriceOf.entriesPaged({
      args: [0],
      // Page 50 items per each 50 memberships to buy. That way, we'll have enough space to ignore
      // items not on public sale.
      pageSize: 50 * Math.ceil(membershipAccounts.length / 50),
    });

  return itemsForSale
    .map(([key, value], i) => {
      const itemKey = (key.toHuman() as unknown as string[])[1];
      const preItem = (key.toHuman() as unknown as string[])[1].replaceAll(
        /\D/g,
        ""
      );
      const item = Number(preItem);
      const [price, buyer] = (value as unknown as { unwrap: () => [u128, Option<any>] })
        .unwrap();
      console.log(itemKey, preItem, item);

      return {
        item,
        price: price.toNumber(),
        buyer,
        accountToAssign: membershipAccounts[i],
      } as MembershipItemQuote;
    })
    .filter(({ buyer }) => buyer.isNone)
    .slice(0, membershipAccounts.length);
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
