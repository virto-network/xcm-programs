import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";
import { AccountMembership } from "../../types";

export function initiativeRemoveMembers(
    kreivoApi: ApiPromise,
    membershipAccountsRemove: AccountMembership[] = [],
) {
    return membershipAccountsRemove.map((account) =>
        kreivoApi.tx.communities.removeMember(
            {
                Id: account.accountId,
            },
            account.membershipId
        )
    );
}
