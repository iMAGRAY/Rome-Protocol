import { WalletPair, ContractDeployResult } from '../types';
export declare class ContractDeployer {
    private provider;
    private rpcUrls;
    private currentRpcIndex;
    constructor();
    private switchRpc;
    validateConnection(): Promise<boolean>;
    private getHelloWorldContract;
    deployHelloWorld(walletPair: WalletPair): Promise<ContractDeployResult>;
    interactWithContract(contractAddress: string, walletPair: WalletPair, newGreeting?: string): Promise<boolean>;
    deployMultipleContracts(walletPairs: WalletPair[], count?: number): Promise<Map<string, ContractDeployResult[]>>;
    getContractCode(address: string): Promise<string>;
    verifyContract(address: string): Promise<boolean>;
    estimateDeploymentCost(): Promise<{
        gasEstimate: bigint;
        costInEth: string;
    }>;
}
//# sourceMappingURL=ContractDeployer.d.ts.map