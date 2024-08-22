import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";
import { AccountId } from "../../types";

export function initiativeAddMembers(
    kreivoApi: ApiPromise,
    membershipAccountsAdd: AccountId[] = [],
) {
    return membershipAccountsAdd.map((account) =>
        kreivoApi.tx.communities.addMember(
            {
                Id: account,
            },
        )
    );
}
