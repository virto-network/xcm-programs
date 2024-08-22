import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";
import { blake2AsHex } from '@polkadot/util-crypto';

import { Signer } from "@polkadot/api/types";
import { AccountId, AccountMembership, Conviction, TreasuryPeriod, VoteOpenGov } from "../types";
import { initiativeRemoveMembers } from "./remove-members";
import { initiativeAddMembers } from "./add-members";
import { initiativeTreasuryRequest } from "./treasury";
import { initiativeConvictionVoting } from "./conviction-voting";

export async function topupThenInitiativeSetup(
    // Injected parameters
    providers: Record<string, WsProvider>,
    address: string,
    signer: Signer,
    // Provided
    communityId: number,
    initiativeId: number,
    roomId: string,
    title: string,
    membershipAccountsAdd: AccountId[] = [],
    membershipAccountsRemove: AccountMembership[] = [],
    periodsTreasuryRequest: TreasuryPeriod[] = [],
    votingOpenGov: VoteOpenGov[] = [],
) {
    const kreivoApi = await ApiPromise.create({
        provider: providers.kreivo,
    });

    const kusamaApi = await ApiPromise.create({
        provider: providers.kusama,
    });

    let callsOnBatch = [];
    let proposal;

    let addMembers = (membershipAccountsAdd.length > 0) ? initiativeAddMembers(kreivoApi, membershipAccountsAdd) : [];
    let removeMembers = (membershipAccountsRemove.length > 0) ? initiativeRemoveMembers(kreivoApi, membershipAccountsRemove) : [];
    let treasury = (periodsTreasuryRequest.length > 0) ? initiativeTreasuryRequest(kreivoApi, kusamaApi, communityId, periodsTreasuryRequest, title) : { calls: [], inline: [] };

    let voting = (votingOpenGov.length > 0) ? await initiativeConvictionVoting(kreivoApi, kusamaApi, communityId, votingOpenGov) : [];

    callsOnBatch = [
        ...treasury.calls
    ]

    const inlineProposal = kreivoApi.tx.utility.batchAll([
        ...addMembers, ...removeMembers, ...treasury.inline, ...voting
    ]).method.toHex();

    console.log({ inlineProposal })

    if ((inlineProposal.length - 2) / 2 > 128) {
        const preimageCallInitiative = kreivoApi.tx.preimage.notePreimage(
            inlineProposal
        );

        callsOnBatch.push(preimageCallInitiative);

        const hash = blake2AsHex(inlineProposal);

        proposal = {
            Lookup: {
                hash,
                len: (inlineProposal.length - 2) / 2
            }
        }
    } else {
        proposal = {
            Inline: inlineProposal
        }
    }

    const initiativeSubmit = kreivoApi.tx.communityReferenda.submit(
        {
            Communities: {
                communityId
            }
        },
        proposal,
        {
            After: 0
        }
    );

    console.log({ initiativeSubmit: initiativeSubmit.method.toHex() })

    const initiativePreimageMetadata = kreivoApi.tx.preimage.notePreimage(
        roomId
    );

    const maybeHash = blake2AsHex(roomId);

    const initiativeReferendaMetadata = kreivoApi.tx.communityReferenda.setMetadata(
        initiativeId,
        maybeHash
    );

    const initiativePlaceDecisionDeposit = kreivoApi.tx.communityReferenda.placeDecisionDeposit(
        initiativeId
    );

    return kreivoApi.tx.utility
        .batchAll([
            ...callsOnBatch,
            initiativeSubmit,
            initiativePreimageMetadata,
            initiativeReferendaMetadata,
            initiativePlaceDecisionDeposit
        ])
        .signAndSend(address, { signer }, () => console.log("sign"));
}
