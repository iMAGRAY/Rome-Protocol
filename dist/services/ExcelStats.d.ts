import { AutomationStats, WalletPair, TransactionResult, ContractDeployResult } from '../types';
export interface ExcelWalletData {
    номер: number;
    solana_адрес: string;
    evm_адрес: string;
    solana_баланс: number;
    evm_баланс: string;
    количество_взаимодействий: number;
    время_создания: string;
}
export interface ExcelTransactionData {
    номер: number;
    хэш: string;
    от_кошелька: string;
    к_кошельку: string;
    сумма_eth: string;
    газ_использован: number;
    успешная: boolean;
    время: string;
    тип_активности: string;
}
export interface ExcelContractData {
    номер: number;
    адрес_контракта: string;
    владелец: string;
    хэш_деплоя: string;
    газ_деплоя: number;
    успешный_деплой: boolean;
    время_деплоя: string;
    количество_взаимодействий: number;
}
export interface ExcelSummaryData {
    параметр: string;
    значение: string | number;
    описание: string;
}
export declare class ExcelStats {
    private excelPath;
    private walletData;
    private transactionData;
    private contractData;
    private summaryData;
    private transactionCounter;
    private contractCounter;
    constructor();
    initializeSummary(stats: AutomationStats): void;
    addWallet(wallet: WalletPair, index: number): void;
    updateWalletBalance(address: string, solBalance: number, evmBalance: string): void;
    addTransaction(result: TransactionResult, fromAddress: string, toAddress: string, amount: string, activityType: string): void;
    addContract(result: ContractDeployResult, ownerAddress: string): void;
    addContractInteraction(contractAddress: string): void;
    saveToExcel(): Promise<void>;
    private generateActivitySummary;
    private getActivityDescription;
    loadExistingData(): Promise<void>;
    getStats(): {
        wallets: number;
        transactions: number;
        contracts: number;
        filePath: string;
    };
}
//# sourceMappingURL=ExcelStats.d.ts.map