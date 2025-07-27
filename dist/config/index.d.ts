import { RomeConfig } from '../types';
export declare const config: {
    encryption: {
        key: string;
    };
    wallet: {
        seed: string;
        defaultCount: number;
        defaultContracts: number;
    };
    solana: {
        rpcUrl: string;
        faucetUrl: string;
    };
    rome: RomeConfig;
    transactions: {
        maxTransactions: number;
        batchSize: number;
        delayMs: number;
    };
    activity: {
        minDelayMs: number;
        maxDelayMs: number;
        minAmount: number;
        maxAmount: number;
    };
    googleForms: {
        url: string;
        addressEntry: string;
        txCountEntry: string;
    };
    browser: {
        headless: boolean;
        timeout: number;
        takeScreenshots: boolean;
    };
    excel: {
        saveStats: boolean;
        fileName: string;
    };
    debug: {
        enabled: boolean;
        logLevel: string;
    };
};
export declare function validateConfig(): boolean;
//# sourceMappingURL=index.d.ts.map