import "@polkadot/api-augment/kusama";
import { WsProvider, ApiPromise } from "@polkadot/api";

import { Signer } from "@polkadot/api/types";
import { AccountId } from "../types";

export async function withdraw(
    // Injected parameters
    providers: Record<string, WsProvider>,
    address: string,
    signer: Signer,
    // Provided
    destination: AccountId,
    amount: number
) {
    const kreivoApi = await ApiPromise.create({
        provider: providers.kreivo,
    });

    const dest = {
        V3: {
            parents: 1,
            interior: 'Here'
        }
    };

    const beneficiary = {
        V3: {
            parents: 0,
            interior: {
                X1: {
                    AccountId32: {
                        id: destination
                    }
                }
            }
        }
    };

    const assets = {
        V3: [
            {
                id: {
                    Concrete: {
                        parents: 1,
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
    const weightLimit = 'Unlimited'

    const call = kreivoApi.tx.polkadotXcm.transferAssets(
        dest,
        beneficiary,
        assets,
        feeAssetItem,
        weightLimit
    );

    console.log(call.method.toHex())

    return kreivoApi.tx.polkadotXcm.transferAssets(
        dest,
        beneficiary,
        assets,
        feeAssetItem,
        weightLimit
    ).signAndSend(address, { signer }, () => console.log("sign widthdraw"));
}

