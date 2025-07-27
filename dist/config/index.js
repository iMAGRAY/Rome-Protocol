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
    googleForms: {
        url: process.env.GOOGLE_FORM_URL || '',
        addressEntry: process.env.GOOGLE_FORM_ENTRY_ADDRESS || '',
        txCountEntry: process.env.GOOGLE_FORM_ENTRY_TX_COUNT || '',
    },
    browser: {
        headless: process.env.HEADLESS === 'true',
        timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
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