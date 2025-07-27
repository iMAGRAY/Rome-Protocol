"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    encryption: {
        key: process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32',
    },
    wallet: {
        seed: process.env.WALLET_SEED || 'default seed phrase for wallet generation',
        defaultCount: parseInt(process.env.DEFAULT_WALLET_COUNT || '5'),
        defaultContracts: parseInt(process.env.DEFAULT_CONTRACTS_PER_WALLET || '1'),
    },
    solana: {
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        faucetUrl: process.env.SOLANA_FAUCET_URL || 'https://faucet.solana.com/api/v1/airdrop',
    },
    rome: {
        depositUrl: process.env.ROME_DEPOSIT_URL || 'https://deposit.testnet.romeprotocol.xyz',
        chainId: parseInt(process.env.ROME_CHAIN_ID || '57005'),
        rpcUrl: process.env.ROME_RPC_URL || 'https://caelian.testnet.romeprotocol.xyz/',
        martisRpcUrl: process.env.ROME_MARTIS_RPC_URL || 'https://martis.testnet.romeprotocol.xyz/',
    },
    transactions: {
        maxTransactions: parseInt(process.env.MAX_TRANSACTIONS || '10000'),
        batchSize: parseInt(process.env.TX_BATCH_SIZE || '50'),
        delayMs: parseInt(process.env.TX_DELAY_MS || '100'),
    },
    activity: {
        minDelayMs: parseInt(process.env.ACTIVITY_MIN_DELAY_SEC || '30') * 1000,
        maxDelayMs: parseInt(process.env.ACTIVITY_MAX_DELAY_SEC || '300') * 1000,
        minAmount: parseFloat(process.env.ACTIVITY_MIN_AMOUNT || '0.001'),
        maxAmount: parseFloat(process.env.ACTIVITY_MAX_AMOUNT || '0.011'),
    },
    googleForms: {
        url: process.env.GOOGLE_FORM_URL || '',
        addressEntry: process.env.GOOGLE_FORM_ENTRY_ADDRESS || '',
        txCountEntry: process.env.GOOGLE_FORM_ENTRY_TX_COUNT || '',
    },
    browser: {
        headless: process.env.HEADLESS === 'true',
        timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
        takeScreenshots: process.env.TAKE_SCREENSHOTS === 'true',
    },
    excel: {
        saveStats: process.env.SAVE_EXCEL_STATS !== 'false', // По умолчанию включено
        fileName: process.env.EXCEL_FILE_NAME || 'rome_protocol_stats.xlsx',
    },
    debug: {
        enabled: process.env.DEBUG === 'true',
        logLevel: process.env.LOG_LEVEL || 'info',
    },
};
function validateConfig() {
    if (!exports.config.encryption.key || exports.config.encryption.key.length < 32) {
        console.error('ENCRYPTION_KEY must be at least 32 characters');
        return false;
    }
    if (!exports.config.solana.rpcUrl) {
        console.error('SOLANA_RPC_URL is required');
        return false;
    }
    if (!exports.config.rome.rpcUrl) {
        console.error('ROME_RPC_URL is required');
        return false;
    }
    return true;
}
//# sourceMappingURL=index.js.map