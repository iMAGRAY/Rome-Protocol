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
            // Method 1: Try using @solana/web3.js requestAirdrop
            try {
                const signature = await this.connection.requestAirdrop(pubKey, amount * web3_js_1.LAMPORTS_PER_SOL);
                // Wait for confirmation
                const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
                if (!confirmation.value.err) {
                    this.lastRequest.set(publicKey, now);
                    logger_1.logger.info(`Successfully requested ${amount} SOL via RPC for ${publicKey}`);
                    return true;
                }
            }
            catch (rpcError) {
                logger_1.logger.warn(`RPC airdrop failed for ${publicKey}, trying web faucet`);
            }
            // Method 2: Try web faucet
            try {
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
                    this.lastRequest.set(publicKey, now);
                    logger_1.logger.info(`Successfully requested ${amount} SOL via web faucet for ${publicKey}`);
                    return true;
                }
            }
            catch (webError) {
                logger_1.logger.warn(`Web faucet failed for ${publicKey}`);
            }
            // Method 3: Try alternative faucet endpoints
            const alternativeFaucets = [
                'https://faucet.solana.com/api/v1/airdrop',
                'https://api.devnet.solana.com/airdrop',
            ];
            for (const faucetEndpoint of alternativeFaucets) {
                try {
                    const response = await axios_1.default.post(faucetEndpoint, {
                        account: publicKey,
                        lamports: amount * web3_js_1.LAMPORTS_PER_SOL
                    }, {
                        timeout: 15000
                    });
                    if (response.status === 200) {
                        this.lastRequest.set(publicKey, now);
                        logger_1.logger.info(`Successfully requested ${amount} SOL via ${faucetEndpoint} for ${publicKey}`);
                        return true;
                    }
                }
                catch (error) {
                    // Continue to next faucet
                }
            }
            logger_1.logger.error(`All faucet methods failed for ${publicKey}`);
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
        for (const publicKey of publicKeys) {
            try {
                const success = await this.requestAirdrop(publicKey, amount);
                results.set(publicKey, success);
                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            catch (error) {
                logger_1.logger.error(`Failed to request airdrop for ${publicKey}`, error);
                results.set(publicKey, false);
            }
        }
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
}
exports.SolanaFaucet = SolanaFaucet;
//# sourceMappingURL=SolanaFaucet.js.map