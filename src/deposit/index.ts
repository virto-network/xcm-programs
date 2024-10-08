import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";
import { Signer } from "@polkadot/api/types";

export async function deposit(
    providers: Record<string, WsProvider>,
    address: string,
    signer: Signer,
    destination: String,
    amount: number,
    to_community: boolean
) {
    const kusamaApi = await ApiPromise.create({
        provider: providers.kusama,
    });

    const dest = {
        V4: {
            parents: 0,
            interior: {
                X1: [
                    { Parachain: 2281 }
                ]
            }
        }
    };

    let beneficiary;

    if (to_community) {
        beneficiary = {
            V4: {
                parents: 0,
                interior: {
                    X1: [
                        {
                            Plurality: {
                                id: {
                                    Index: destination
                                }
                            },
                            part: "Voice"
                        }
                    ]
                }
            }
        }
    } else {
        beneficiary = {
            V4: {
                parents: 0,
                interior: {
                    X1: [
                        {
                            AccountId32: {
                                id: destination
                            }
                        }
                    ]
                }
            }
        }
    }

    const assets = {
        V4: [
            {
                id: {
                    Concrete: {
                        parents: 0,
                        interior: 'Here'
                    }
                },
                fun: {
                    Fungible: amount
                }
            }
        ]
    };

    const feeAssetItem = 0;
    const weightLimit = {
        Unlimited: null
    };

    const inlineCall = kusamaApi.tx.xcmPallet.limitedReserveTransferAssets(
        dest,
        beneficiary,
        assets,
        feeAssetItem,
        weightLimit
    );

    return inlineCall.signAndSend(address, { signer }, () => console.log("sign withdraw"));
}
