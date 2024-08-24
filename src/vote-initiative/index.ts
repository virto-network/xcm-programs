import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";

import { Signer } from "@polkadot/api/types";
import { MembershipId, PollIndex } from "../types";

export async function initiativeVote(
    // Injected parameters
    providers: Record<string, WsProvider>,
    address: string,
    signer: Signer,
    // Provided
    membershipId: MembershipId,
    pollIndex: PollIndex,
    vote: boolean
) {
    const kreivoApi = await ApiPromise.create({
        provider: providers.kreivo,
    });

    return kreivoApi.tx.communities.vote(
        membershipId,
        pollIndex,
        {
            Standard: vote
        }
    ).signAndSend(address, { signer }, () => console.log("sign vote"));
}

