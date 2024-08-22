import "@polkadot/api-augment/kusama";
import { ApiPromise } from "@polkadot/api";
import { blake2AsHex } from '@polkadot/util-crypto';

import { location, fungibleAsset, interior } from "../../common";
import { TreasuryPeriod } from "../../types";

export function initiativeTreasuryRequest(
    kreivoApi: ApiPromise,
    kusamaApi: ApiPromise,
    communityId: number,
    periods: TreasuryPeriod[] = [],
    title: string
) {
    let callsOnBatch = [];
    let proposal;

    const remarkSpendKusama = kusamaApi.tx.system.remark(
        title
    )

    // Part 1: Kusama Treasury batch
    const treasurySpendKusama = periods.map((period, index) => {
        return kusamaApi.tx.treasury.spend(
            {
                V4: {
                    location: {
                        parents: 0,
                        interior: {
                            X1: [{
                                Parachain: 1000
                            }]
                        }
                    },
                    assetId: {
                        parents: 1,
                        interior: "Here"
                    }
                }
            },
            period.amount,
            {
                V4: {
                    parents: 1,
                    interior: {
                        X2: [
                            {
                                Parachain: 2281
                            },
                            {
                                Plurality: {
                                    id: {
                                        Index: communityId
                                    },
                                    part: "Voice"
                                }
                            }
                        ]
                    }
                }
            },
            period.blocks
        )
    });

    const inlineCallKusama = kusamaApi.tx.utility.batch([
        remarkSpendKusama, ...treasurySpendKusama
    ]).method.toHex();

    console.log({ inlineCallKusama })

    if (inlineCallKusama.length > 128) {
        const preimageCallKusama = kreivoApi.tx.preimage.notePreimage(
            inlineCallKusama
        );

        callsOnBatch.push(preimageCallKusama);

        const hash = blake2AsHex(inlineCallKusama);

        proposal = {
            Lookup: {
                hash,
                len: (inlineCallKusama.length - 2) / 2
            }
        }
    } else {
        proposal = {
            Inline: inlineCallKusama
        }
    }

    const referendaSubmitKusama = kusamaApi.tx.referenda.submit(
        {
            Origins: "BigSpender"

        },
        proposal,
        {
            At: 0
        },
    ).method.toHex();

    console.log({ referendaSubmitKusama })

    const initiativeTreasuryRequest = kreivoApi.tx.polkadotXcm.send(
        {
            V4: location`../Here`
        },
        {
            V4: [
                // Part 0: Withdraw Asset
                kusamaApi.createType("StagingXcmV4Instruction", {
                    WithdrawAsset: [fungibleAsset(location`./Here`, 1_000_000_000_000)],
                }),
                // Part 1: Buy Execution
                kusamaApi.createType("StagingXcmV4Instruction", {
                    BuyExecution: {
                        fees: fungibleAsset(location`./Here`, 1_000_000_000_000),
                        weightLimit: "Unlimited"
                    },
                }),
                // Part 2: Transact
                kusamaApi.createType("StagingXcmV4Instruction", {
                    Transact: {
                        originKind: "SovereignAccount",
                        requireWeightAtMost: {
                            refTime: 382013000,
                            proofSize: 42428
                        },
                        call: {
                            encoded: referendaSubmitKusama
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
                        assets: "Definite",
                        beneficiary: {
                            parents: 0,
                            interior: {
                                X2: [
                                    {
                                        Parachain: 2281
                                    },
                                    {
                                        Plurality: {
                                            id: {
                                                Index: communityId
                                            },
                                            part: "Voice"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            ]
        }
    );

    console.log({ initiativeTreasuryRequest: initiativeTreasuryRequest.method.toHex() })

    return {
        calls: [...callsOnBatch],
        inline: [initiativeTreasuryRequest]
    }
}
