import { WsProvider } from "@polkadot/api";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import type { Signer } from "@polkadot/types/types";
import type { ExecutableFunctionOf } from "./types";

export class XcmProgramsExecutor {
  private providers: Record<string, WsProvider> = {};

  private address?: string;
  private signer?: Signer;

  constructor(providers: Record<string, string | string[]>) {
    for (const [key, endpoint] of Object.entries(providers)) {
      this.providers[key] = new WsProvider(endpoint);
    }
  }

  async initialize(appName: string) {
    await web3Enable(appName);
  }

  async setSigner(address: string) {
    this.address = address;
    this.signer = (await web3FromAddress(address)).signer;
  }

  async execute<T>(fn: ExecutableFunctionOf<T>, ...params: any[]): Promise<T> {
    if (!this.address || !this.signer) {
      throw new Error('address must be defined');
    }
    return fn(this.providers, this.address, this.signer, ...params);
  }
}
