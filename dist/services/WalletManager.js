"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletManager = void 0;
const web3_js_1 = require("@solana/web3.js");
const ethers_1 = require("ethers");
const bip39 = __importStar(require("bip39"));
const ed25519_hd_key_1 = require("ed25519-hd-key");
const crypto_js_1 = __importDefault(require("crypto-js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class WalletManager {
    walletsDir;
    encryptionKey;
    constructor() {
        this.walletsDir = path_1.default.join(process.cwd(), 'wallets');
        this.encryptionKey = config_1.config.encryption.key;
        this.ensureWalletsDirectory();
    }
    ensureWalletsDirectory() {
        if (!fs_1.default.existsSync(this.walletsDir)) {
            fs_1.default.mkdirSync(this.walletsDir, { recursive: true });
            logger_1.logger.info('Created wallets directory');
        }
    }
    async generateWalletPair() {
        try {
            // Generate mnemonic
            const mnemonic = bip39.generateMnemonic();
            const seed = await bip39.mnemonicToSeed(mnemonic);
            // Generate Solana keypair
            const solanaDerivationPath = "m/44'/501'/0'/0'";
            const solanaDerived = (0, ed25519_hd_key_1.derivePath)(solanaDerivationPath, seed.toString('hex'));
            const solanaKeypair = web3_js_1.Keypair.fromSeed(solanaDerived.key);
            // Generate EVM wallet
            const hdNode = ethers_1.ethers.HDNodeWallet.fromSeed(seed);
            const evmWallet = hdNode.derivePath("m/44'/60'/0'/0/0");
            const walletPair = {
                solana: {
                    publicKey: solanaKeypair.publicKey.toString(),
                    privateKey: Buffer.from(solanaKeypair.secretKey).toString('hex'),
                    keypair: solanaKeypair,
                },
                evm: {
                    address: evmWallet.address,
                    privateKey: evmWallet.privateKey,
                },
            };
            logger_1.logger.info(`Generated wallet pair: Solana ${walletPair.solana.publicKey}, EVM ${walletPair.evm.address}`);
            return walletPair;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate wallet pair', error);
            throw error;
        }
    }
    encryptWallet(walletPair) {
        try {
            const data = JSON.stringify(walletPair);
            const salt = crypto_js_1.default.lib.WordArray.random(128 / 8);
            const iv = crypto_js_1.default.lib.WordArray.random(128 / 8);
            const key = crypto_js_1.default.PBKDF2(this.encryptionKey, salt, {
                keySize: 256 / 32,
                iterations: 1000
            });
            const encrypted = crypto_js_1.default.AES.encrypt(data, key, {
                iv: iv,
                padding: crypto_js_1.default.pad.Pkcs7,
                mode: crypto_js_1.default.mode.CBC
            });
            return {
                encrypted: encrypted.toString(),
                salt: salt.toString(),
                iv: iv.toString(),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt wallet', error);
            throw error;
        }
    }
    decryptWallet(encryptedWallet) {
        try {
            const salt = crypto_js_1.default.enc.Hex.parse(encryptedWallet.salt);
            const iv = crypto_js_1.default.enc.Hex.parse(encryptedWallet.iv);
            const key = crypto_js_1.default.PBKDF2(this.encryptionKey, salt, {
                keySize: 256 / 32,
                iterations: 1000
            });
            const decrypted = crypto_js_1.default.AES.decrypt(encryptedWallet.encrypted, key, {
                iv: iv,
                padding: crypto_js_1.default.pad.Pkcs7,
                mode: crypto_js_1.default.mode.CBC
            });
            const decryptedData = decrypted.toString(crypto_js_1.default.enc.Utf8);
            const walletPair = JSON.parse(decryptedData);
            // Recreate Solana keypair
            const secretKey = new Uint8Array(Buffer.from(walletPair.solana.privateKey, 'hex'));
            walletPair.solana.keypair = web3_js_1.Keypair.fromSecretKey(secretKey);
            return walletPair;
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt wallet', error);
            throw error;
        }
    }
    saveWallet(walletPair, filename) {
        try {
            const encrypted = this.encryptWallet(walletPair);
            const walletFilename = filename || `wallet_${Date.now()}.json`;
            const filepath = path_1.default.join(this.walletsDir, walletFilename);
            fs_1.default.writeFileSync(filepath, JSON.stringify(encrypted, null, 2));
            logger_1.logger.info(`Wallet saved to ${filepath}`);
            return filepath;
        }
        catch (error) {
            logger_1.logger.error('Failed to save wallet', error);
            throw error;
        }
    }
    loadWallet(filepath) {
        try {
            if (!fs_1.default.existsSync(filepath)) {
                throw new Error(`Wallet file not found: ${filepath}`);
            }
            const encryptedData = fs_1.default.readFileSync(filepath, 'utf8');
            const encryptedWallet = JSON.parse(encryptedData);
            return this.decryptWallet(encryptedWallet);
        }
        catch (error) {
            logger_1.logger.error(`Failed to load wallet from ${filepath}`, error);
            throw error;
        }
    }
    listWallets() {
        try {
            return fs_1.default.readdirSync(this.walletsDir)
                .filter(file => file.endsWith('.json'))
                .map(file => path_1.default.join(this.walletsDir, file));
        }
        catch (error) {
            logger_1.logger.error('Failed to list wallets', error);
            return [];
        }
    }
    async checkBalances(walletPair) {
        try {
            // Check Solana balance
            const connection = new web3_js_1.Connection(config_1.config.solana.rpcUrl, 'confirmed');
            const solBalance = await connection.getBalance(new web3_js_1.PublicKey(walletPair.solana.publicKey));
            // Check EVM balance
            const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rome.rpcUrl);
            const evmBalance = await provider.getBalance(walletPair.evm.address);
            return {
                solBalance: solBalance / 1e9, // Convert lamports to SOL
                evmBalance: ethers_1.ethers.formatEther(evmBalance)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to check balances', error);
            throw error;
        }
    }
    async generateMultipleWallets(count) {
        const wallets = [];
        for (let i = 0; i < count; i++) {
            try {
                const wallet = await this.generateWalletPair();
                this.saveWallet(wallet, `wallet_${i + 1}_${Date.now()}.json`);
                wallets.push(wallet);
                // Small delay to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                logger_1.logger.error(`Failed to generate wallet ${i + 1}`, error);
            }
        }
        logger_1.logger.info(`Generated ${wallets.length} wallets`);
        return wallets;
    }
}
exports.WalletManager = WalletManager;
//# sourceMappingURL=WalletManager.js.map