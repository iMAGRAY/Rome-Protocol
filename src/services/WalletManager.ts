import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';
import { WalletPair, EncryptedWallet } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class WalletManager {
  private walletsDir: string;
  private encryptionKey: string;

  constructor() {
    this.walletsDir = path.join(process.cwd(), 'wallets');
    this.encryptionKey = config.encryption.key;
    this.ensureWalletsDirectory();
  }

  private ensureWalletsDirectory(): void {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true });
      logger.info('Created wallets directory');
    }
  }

  public async generateWalletPair(): Promise<WalletPair> {
    try {
      // Generate mnemonic
      const mnemonic = bip39.generateMnemonic();
      const seed = await bip39.mnemonicToSeed(mnemonic);

      // Generate Solana keypair
      const solanaDerivationPath = "m/44'/501'/0'/0'";
      const solanaDerived = derivePath(solanaDerivationPath, seed.toString('hex'));
      const solanaKeypair = Keypair.fromSeed(solanaDerived.key);

      // Generate EVM wallet
      const hdNode = ethers.HDNodeWallet.fromSeed(seed);
      const evmWallet = hdNode.derivePath("m/44'/60'/0'/0/0");

      const walletPair: WalletPair = {
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

      logger.info(`Generated wallet pair: Solana ${walletPair.solana.publicKey}, EVM ${walletPair.evm.address}`);
      return walletPair;
    } catch (error) {
      logger.error('Failed to generate wallet pair', error);
      throw error;
    }
  }

  public encryptWallet(walletPair: WalletPair): EncryptedWallet {
    try {
      const data = JSON.stringify(walletPair);
      const salt = CryptoJS.lib.WordArray.random(128/8);
      const iv = CryptoJS.lib.WordArray.random(128/8);
      
      const key = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256/32,
        iterations: 1000
      });

      const encrypted = CryptoJS.AES.encrypt(data, key, { 
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
      });

      return {
        encrypted: encrypted.toString(),
        salt: salt.toString(),
        iv: iv.toString(),
      };
    } catch (error) {
      logger.error('Failed to encrypt wallet', error);
      throw error;
    }
  }

  public decryptWallet(encryptedWallet: EncryptedWallet): WalletPair {
    try {
      const salt = CryptoJS.enc.Hex.parse(encryptedWallet.salt);
      const iv = CryptoJS.enc.Hex.parse(encryptedWallet.iv);
      
      const key = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256/32,
        iterations: 1000
      });

      const decrypted = CryptoJS.AES.decrypt(encryptedWallet.encrypted, key, { 
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
      });

      const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);
      const walletPair = JSON.parse(decryptedData) as WalletPair;
      
      // Recreate Solana keypair
      const secretKey = new Uint8Array(Buffer.from(walletPair.solana.privateKey, 'hex'));
      walletPair.solana.keypair = Keypair.fromSecretKey(secretKey);

      return walletPair;
    } catch (error) {
      logger.error('Failed to decrypt wallet', error);
      throw error;
    }
  }

  public saveWallet(walletPair: WalletPair, filename?: string): string {
    try {
      const encrypted = this.encryptWallet(walletPair);
      const walletFilename = filename || `wallet_${Date.now()}.json`;
      const filepath = path.join(this.walletsDir, walletFilename);
      
      fs.writeFileSync(filepath, JSON.stringify(encrypted, null, 2));
      logger.info(`Wallet saved to ${filepath}`);
      
      return filepath;
    } catch (error) {
      logger.error('Failed to save wallet', error);
      throw error;
    }
  }

  public loadWallet(filepath: string): WalletPair {
    try {
      if (!fs.existsSync(filepath)) {
        throw new Error(`Wallet file not found: ${filepath}`);
      }
      
      const encryptedData = fs.readFileSync(filepath, 'utf8');
      const encryptedWallet = JSON.parse(encryptedData) as EncryptedWallet;
      
      return this.decryptWallet(encryptedWallet);
    } catch (error) {
      logger.error(`Failed to load wallet from ${filepath}`, error);
      throw error;
    }
  }

  public listWallets(): string[] {
    try {
      return fs.readdirSync(this.walletsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.walletsDir, file));
    } catch (error) {
      logger.error('Failed to list wallets', error);
      return [];
    }
  }

  public async checkBalances(walletPair: WalletPair): Promise<{ solBalance: number; evmBalance: string }> {
    try {
      // Check Solana balance
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const solBalance = await connection.getBalance(new PublicKey(walletPair.solana.publicKey));
      
      // Check EVM balance
      const provider = new ethers.JsonRpcProvider(config.rome.rpcUrl);
      const evmBalance = await provider.getBalance(walletPair.evm.address);

      return {
        solBalance: solBalance / 1e9, // Convert lamports to SOL
        evmBalance: ethers.formatEther(evmBalance)
      };
    } catch (error) {
      logger.error('Failed to check balances', error);
      throw error;
    }
  }

  public async generateMultipleWallets(count: number): Promise<WalletPair[]> {
    const wallets: WalletPair[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const wallet = await this.generateWalletPair();
        this.saveWallet(wallet, `wallet_${i + 1}_${Date.now()}.json`);
        wallets.push(wallet);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Failed to generate wallet ${i + 1}`, error);
      }
    }
    
    logger.info(`Generated ${wallets.length} wallets`);
    return wallets;
  }
}