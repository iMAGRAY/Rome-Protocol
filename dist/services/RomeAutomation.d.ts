import { WalletPair, AutomationStats, ContractDeployResult } from '../types';
export declare class RomeAutomation {
    private walletManager;
    private solanaFaucet;
    private browserAutomation;
    private contractDeployer;
    private transactionBot;
    private googleFormsService;
    private stats;
    private wallets;
    private deployedContracts;
    constructor();
    createWallets(count?: number): Promise<WalletPair[]>;
    requestSolanaFunds(): Promise<boolean>;
    connectToRome(): Promise<boolean>;
    bridgeSolToRSol(): Promise<boolean>;
    deployContracts(contractsPerWallet?: number): Promise<ContractDeployResult[]>;
    startRandomActivity(): Promise<void>;
    private runRandomActivity;
    private executeRandomTransfer;
    private executeRandomContractInteraction;
    private executeRandomContractDeployment;
    private executeMultiTransfer;
    private executeRandomContractCall;
    private executeBalanceCheck;
    submitRewardForms(): Promise<boolean>;
    executeFullAutomation(options?: {
        walletCount?: number;
        contractsPerWallet?: number;
        startRandomActivity?: boolean;
        submitForms?: boolean;
    }): Promise<AutomationStats>;
    retryOperation<T>(operation: () => Promise<T>, maxRetries?: number, delayMs?: number): Promise<T>;
    private saveProgress;
    loadProgress(filepath: string): Promise<boolean>;
    getStats(): AutomationStats;
    private logFinalStats;
    cleanup(): Promise<void>;
    healthCheck(): Promise<{
        [key: string]: boolean;
    }>;
}
//# sourceMappingURL=RomeAutomation.d.ts.map