import { WalletPair, TransactionResult } from '../types';
export declare class TransactionBot {
    private provider;
    private rpcUrls;
    private currentRpcIndex;
    private transactionCount;
    private errorCount;
    private successCount;
    private rateLimit;
    constructor();
    private switchRpc;
    private checkRateLimit;
    sendTransaction(fromWallet: WalletPair, toAddress: string, amountInEth: string, data?: string): Promise<TransactionResult>;
    sendRandomTransactions(wallets: WalletPair[], targetCount?: number, amountRange?: {
        min: string;
        max: string;
    }): Promise<TransactionResult[]>;
    sendCircularTransactions(wallets: WalletPair[], cycles: number, amountPerTx?: string): Promise<TransactionResult[]>;
    interactWithContracts(wallets: WalletPair[], contractAddresses: string[], interactionCount: number): Promise<TransactionResult[]>;
    checkAllBalances(wallets: WalletPair[]): Promise<Map<string, string>>;
    distributeEther(sourceWallet: WalletPair, targetWallets: WalletPair[], amountPerWallet: string): Promise<TransactionResult[]>;
    getStats(): {
        total: number;
        successful: number;
        failed: number;
        successRate: number;
    };
    resetStats(): void;
    optimizeGasPrice(): Promise<bigint>;
}
//# sourceMappingURL=TransactionBot.d.ts.map