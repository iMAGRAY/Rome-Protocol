"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaFaucet = void 0;
const web3_js_1 = require("@solana/web3.js");
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class SolanaFaucet {
    connection;
    faucetUrl;
    lastRequest = new Map();
    RATE_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    constructor() {
        this.connection = new web3_js_1.Connection(config_1.config.solana.rpcUrl, 'confirmed');
        this.faucetUrl = config_1.config.solana.faucetUrl;
    }
    async requestAirdrop(publicKey, amount = 2) {
        try {
            // First check if we already have enough SOL
            const currentBalance = await this.getBalance(publicKey);
            if (currentBalance >= 1) {
                logger_1.logger.info(`Wallet ${publicKey} already has ${currentBalance} SOL, skipping airdrop`);
                return true;
            }
            const pubKey = new web3_js_1.PublicKey(publicKey);
            const now = Date.now();
            // Check rate limit
            const lastRequestTime = this.lastRequest.get(publicKey);
            if (lastRequestTime && (now - lastRequestTime) < this.RATE_LIMIT_MS) {
                const remainingTime = this.RATE_LIMIT_MS - (now - lastRequestTime);
                const remainingHours = Math.ceil(remainingTime / (60 * 60 * 1000));
                logger_1.logger.warn(`Rate limit active for ${publicKey}. Wait ${remainingHours} hours`);
                return false;
            }
            logger_1.logger.info(`Requesting ${amount} SOL airdrop for ${publicKey}...`);
            // Method 1: Try using @solana/web3.js requestAirdrop
            try {
                const signature = await this.connection.requestAirdrop(pubKey, amount * web3_js_1.LAMPORTS_PER_SOL);
                // Wait for confirmation
                const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
                if (!confirmation.value.err) {
                    this.lastRequest.set(publicKey, now);
                    logger_1.logger.info(`✅ Successfully requested ${amount} SOL via RPC for ${publicKey}`);
                    return true;
                }
            }
            catch (rpcError) {
                if (rpcError?.message?.includes('429') || rpcError?.message?.includes('Too Many Requests')) {
                    logger_1.logger.warn(`⏰ RPC rate limit hit for ${publicKey}, waiting 10 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
                else {
                    logger_1.logger.warn(`RPC airdrop failed for ${publicKey}: ${rpcError?.message || 'Unknown error'}`);
                }
            }
            // Method 2: Try web faucet with smart retry
            logger_1.logger.info(`🌐 Trying web faucet for ${publicKey}...`);
            const webSuccess = await this.tryWebFaucetWithRetry(publicKey, amount);
            if (webSuccess) {
                this.lastRequest.set(publicKey, now);
                return true;
            }
            // Method 3: Try alternative faucet endpoints with delays
            logger_1.logger.info(`🔄 Trying alternative faucets for ${publicKey}...`);
            const altSuccess = await this.tryAlternativeFaucets(publicKey, amount);
            if (altSuccess) {
                this.lastRequest.set(publicKey, now);
                return true;
            }
            logger_1.logger.error(`❌ All faucet methods failed for ${publicKey}`);
            return false;
        }
        catch (error) {
            logger_1.logger.error(`Airdrop request failed for ${publicKey}`, error);
            return false;
        }
    }
    async getBalance(publicKey) {
        try {
            const pubKey = new web3_js_1.PublicKey(publicKey);
            const balance = await this.connection.getBalance(pubKey);
            return balance / web3_js_1.LAMPORTS_PER_SOL;
        }
        catch (error) {
            logger_1.logger.error(`Failed to get balance for ${publicKey}`, error);
            return 0;
        }
    }
    async waitForBalance(publicKey, minBalance = 0.1, timeoutMs = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const balance = await this.getBalance(publicKey);
            if (balance >= minBalance) {
                logger_1.logger.info(`Balance confirmed for ${publicKey}: ${balance} SOL`);
                return true;
            }
            logger_1.logger.info(`Waiting for balance... Current: ${balance} SOL, Required: ${minBalance} SOL`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
        logger_1.logger.error(`Timeout waiting for balance for ${publicKey}`);
        return false;
    }
    async requestMultipleAirdrops(publicKeys, amount = 2) {
        const results = new Map();
        logger_1.logger.info(`🎯 Starting SOL airdrop for ${publicKeys.length} wallets...`);
        for (let i = 0; i < publicKeys.length; i++) {
            const publicKey = publicKeys[i];
            try {
                logger_1.logger.info(`📍 Processing wallet ${i + 1}/${publicKeys.length}: ${publicKey}`);
                const success = await this.requestAirdrop(publicKey, amount);
                results.set(publicKey, success);
                if (success) {
                    logger_1.logger.info(`✅ Wallet ${i + 1}/${publicKeys.length} completed successfully`);
                }
                else {
                    logger_1.logger.warn(`⚠️ Wallet ${i + 1}/${publicKeys.length} failed`);
                }
                // Smart delay between requests - configurable
                if (i < publicKeys.length - 1) {
                    const baseDelay = config_1.config.solana.faucetDelayMs;
                    const delay = Math.min(baseDelay + (publicKeys.length * 500), 20000); // Max 20 seconds
                    logger_1.logger.info(`⏳ Waiting ${delay / 1000}s before next wallet...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to request airdrop for wallet ${i + 1}: ${publicKey}`, error);
                results.set(publicKey, false);
            }
        }
        const successCount = Array.from(results.values()).filter(success => success).length;
        logger_1.logger.info(`🎉 SOL airdrop completed: ${successCount}/${publicKeys.length} successful`);
        return results;
    }
    canRequestAirdrop(publicKey) {
        const lastRequestTime = this.lastRequest.get(publicKey);
        if (!lastRequestTime)
            return true;
        const now = Date.now();
        return (now - lastRequestTime) >= this.RATE_LIMIT_MS;
    }
    getTimeUntilNextRequest(publicKey) {
        const lastRequestTime = this.lastRequest.get(publicKey);
        if (!lastRequestTime)
            return 0;
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        return Math.max(0, this.RATE_LIMIT_MS - timeSinceLastRequest);
    }
    async validateConnection() {
        try {
            const version = await this.connection.getVersion();
            logger_1.logger.info(`Connected to Solana cluster: ${version['solana-core']}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Solana cluster', error);
            return false;
        }
    }
    async tryWebFaucetWithRetry(publicKey, amount, maxRetries) {
        maxRetries = maxRetries || config_1.config.solana.maxRetries;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger_1.logger.info(`🌐 Web faucet attempt ${attempt}/${maxRetries} for ${publicKey}`);
                const response = await axios_1.default.post(this.faucetUrl, {
                    publicKey: publicKey,
                    amount: amount * web3_js_1.LAMPORTS_PER_SOL
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 30000
                });
                if (response.status === 200) {
                    logger_1.logger.info(`✅ Successfully requested ${amount} SOL via web faucet for ${publicKey}`);
                    return true;
                }
            }
            catch (webError) {
                if (webError?.response?.status === 429) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
                    logger_1.logger.warn(`⏰ Web faucet rate limit (attempt ${attempt}). Waiting ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                else {
                    logger_1.logger.warn(`Web faucet attempt ${attempt} failed: ${webError?.message || 'Unknown error'}`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between attempts
                    }
                }
            }
        }
        return false;
    }
    async tryAlternativeFaucets(publicKey, amount) {
        const alternativeFaucets = [
            { url: 'https://api.devnet.solana.com/airdrop', name: 'Solana Devnet' },
            { url: 'https://faucet.solana.com/api/v1/airdrop', name: 'Solana Official' }
        ];
        for (let i = 0; i < alternativeFaucets.length; i++) {
            const faucet = alternativeFaucets[i];
            try {
                logger_1.logger.info(`🔄 Trying ${faucet.name} faucet for ${publicKey}...`);
                const response = await axios_1.default.post(faucet.url, {
                    account: publicKey,
                    lamports: amount * web3_js_1.LAMPORTS_PER_SOL
                }, {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (response.status === 200) {
                    logger_1.logger.info(`✅ Successfully requested ${amount} SOL via ${faucet.name} for ${publicKey}`);
                    return true;
                }
            }
            catch (error) {
                logger_1.logger.warn(`${faucet.name} faucet failed: ${error?.message || 'Unknown error'}`);
                // Add delay between different faucet attempts
                if (i < alternativeFaucets.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        }
        return false;
    }
}
exports.SolanaFaucet = SolanaFaucet;
//# sourceMappingURL=SolanaFaucet.js.map