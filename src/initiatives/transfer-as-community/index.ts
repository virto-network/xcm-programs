import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";
import { AccountId, CommunityTransfer } from "../../types";

export function initiativeTransferAsCommunity(
    kreivoApi: ApiPromise,
    transfers: CommunityTransfer[]
) {
    return transfers.map(({account, value}) => {
        const balancesTransfer = kreivoApi.tx.balances.transferKeepAlive(
            {
                Id: account
            },
            value
        );
    
        return kreivoApi.tx.communities.dispatchAsAccount(
            balancesTransfer
        );
    })
}
