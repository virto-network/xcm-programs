import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";

import { location, fungibleAsset } from "../../common";
import { Vote, VoteOpenGov } from "../../types";

function getVote(vote: Vote) {
    let encodedVote: unknown;
    switch (vote.type) {
        case "Standard":
            encodedVote = {
                Standard: {
                    vote: {
                        aye: vote.aye,
                        conviction: vote.conviction
                    },
                    balance: vote.balance
                },
            };
            break;
        case "Split":
            encodedVote = {
                Split: {
                    aye: vote.aye,
                    nay: vote.nay,
                },
            };
            break;
        case "SplitAbstain":
            encodedVote = {
                SplitAbstain: {
                    aye: vote.aye,
                    nay: vote.nay,
                    abstain: vote.abstain,
                },
            };
            break;
    }

    return encodedVote;
}

export async function initiativeConvictionVoting(
    kreivoApi: ApiPromise,
    kusamaApi: ApiPromise,
    communityId: number,
    proposals: VoteOpenGov[]

) {
    let initiativesToDispatch = await Promise.all(
        proposals.map(async (proposal) => {
            const encodedVote = getVote(proposal.vote);

            const inlineCallKusama = kusamaApi.tx.convictionVoting.vote(
                proposal.pollIndex,
                kusamaApi.createType('PalletConvictionVotingVoteAccountVote', encodedVote)
            );

            let dispatchInfo = await kusamaApi.call.transactionPaymentCallApi.queryCallInfo(
                inlineCallKusama.method.toU8a(),
                inlineCallKusama.method.toU8a().length
            );

            const initiativeVoteOpenGov = kreivoApi.tx.polkadotXcm.send(
                {
                    V4: location`../Here`
                },
                {
                    V4: [
                        // Part 0: Withdraw Asset
                        kusamaApi.createType("StagingXcmV4Instruction", {
                            WithdrawAsset: [fungibleAsset(location`./Here`, 500_000_000)],
                        }),
                        // Part 1: Buy Execution
                        kusamaApi.createType("StagingXcmV4Instruction", {
                            BuyExecution: {
                                fees: fungibleAsset(location`./Here`, 500_000_000),
                                weightLimit: "Unlimited"
                            },
                        }),
                        // Part 2: Transact
                        kusamaApi.createType("StagingXcmV4Instruction", {
                            Transact: {
                                originKind: "SovereignAccount",
                                requireWeightAtMost: dispatchInfo.weight,
                                call: {
                                    encoded: inlineCallKusama.method.toHex()
                                }
                            }
                        }),
                        // Part 3: Expect Transact Status
                        {
                            ExpectTransactStatus: "Success"
                        },
                        // Part 4: Refund Surplus
                        "RefundSurplus",
                        // Part 5: Deposit Asset
                        {
                            DepositAsset: {
                                assets: {
                                    Wild: "All",
                                },
                                beneficiary: location`../Parachain(2281)/Plurality(Index(${communityId}),Voice)`,
                            },
                        }
                    ]
                }
            );

            const initiativeDispatch = kreivoApi.tx.communities.dispatchAsAccount(
                initiativeVoteOpenGov
            );

            return initiativeDispatch
        })
    );

    return initiativesToDispatch
}
