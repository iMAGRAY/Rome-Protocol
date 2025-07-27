import { RomeConfig } from '../types';
export declare const config: {
    encryption: {
        key: string;
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
    googleForms: {
        url: string;
        addressEntry: string;
        txCountEntry: string;
    };
    browser: {
        headless: boolean;
        timeout: number;
    };
};
export declare function validateConfig(): boolean;
//# sourceMappingURL=index.d.ts.map