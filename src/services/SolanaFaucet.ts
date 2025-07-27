import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export class SolanaFaucet {
  private connection: Connection;
  private faucetUrl: string;
  private lastRequest: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    this.faucetUrl = config.solana.faucetUrl;
  }

  public async requestAirdrop(publicKey: string, amount: number = 2): Promise<boolean> {
    try {
      // First check if we already have enough SOL
      const currentBalance = await this.getBalance(publicKey);
      if (currentBalance >= 1) {
        logger.info(`Wallet ${publicKey} already has ${currentBalance} SOL, skipping airdrop`);
        return true;
      }

      const pubKey = new PublicKey(publicKey);
      const now = Date.now();
      
      // Check rate limit
      const lastRequestTime = this.lastRequest.get(publicKey);
      if (lastRequestTime && (now - lastRequestTime) < this.RATE_LIMIT_MS) {
        const remainingTime = this.RATE_LIMIT_MS - (now - lastRequestTime);
        const remainingHours = Math.ceil(remainingTime / (60 * 60 * 1000));
        logger.warn(`Rate limit active for ${publicKey}. Wait ${remainingHours} hours`);
        return false;
      }

      logger.info(`Requesting ${amount} SOL airdrop for ${publicKey}...`);

      // Method 1: Try using @solana/web3.js requestAirdrop
      try {
        const signature = await this.connection.requestAirdrop(
          pubKey,
          amount * LAMPORTS_PER_SOL
        );

        // Wait for confirmation
        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
        
        if (!confirmation.value.err) {
          this.lastRequest.set(publicKey, now);
          logger.info(`✅ Successfully requested ${amount} SOL via RPC for ${publicKey}`);
          return true;
        }
      } catch (rpcError: any) {
        if (rpcError?.message?.includes('429') || rpcError?.message?.includes('Too Many Requests')) {
          logger.warn(`⏰ RPC rate limit hit for ${publicKey}, waiting 10 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          logger.warn(`RPC airdrop failed for ${publicKey}: ${rpcError?.message || 'Unknown error'}`);
        }
      }

      // Method 2: Try web faucet with smart retry
      logger.info(`🌐 Trying web faucet for ${publicKey}...`);
      const webSuccess = await this.tryWebFaucetWithRetry(publicKey, amount);
      if (webSuccess) {
        this.lastRequest.set(publicKey, now);
        return true;
      }

      // Method 3: Try alternative faucet endpoints with delays
      logger.info(`🔄 Trying alternative faucets for ${publicKey}...`);
      const altSuccess = await this.tryAlternativeFaucets(publicKey, amount);
      if (altSuccess) {
        this.lastRequest.set(publicKey, now);
        return true;
      }

      logger.error(`❌ All faucet methods failed for ${publicKey}`);
      return false;

    } catch (error) {
      logger.error(`Airdrop request failed for ${publicKey}`, error);
      return false;
    }
  }

  public async getBalance(publicKey: string): Promise<number> {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error(`Failed to get balance for ${publicKey}`, error);
      return 0;
    }
  }

  public async waitForBalance(publicKey: string, minBalance: number = 0.1, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const balance = await this.getBalance(publicKey);
      
      if (balance >= minBalance) {
        logger.info(`Balance confirmed for ${publicKey}: ${balance} SOL`);
        return true;
      }
      
      logger.info(`Waiting for balance... Current: ${balance} SOL, Required: ${minBalance} SOL`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
    
    logger.error(`Timeout waiting for balance for ${publicKey}`);
    return false;
  }

  public async requestMultipleAirdrops(publicKeys: string[], amount: number = 2): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    logger.info(`🎯 Starting SOL airdrop for ${publicKeys.length} wallets...`);
    
    for (let i = 0; i < publicKeys.length; i++) {
      const publicKey = publicKeys[i];
      try {
        logger.info(`📍 Processing wallet ${i + 1}/${publicKeys.length}: ${publicKey}`);
        
        const success = await this.requestAirdrop(publicKey, amount);
        results.set(publicKey, success);
        
        if (success) {
          logger.info(`✅ Wallet ${i + 1}/${publicKeys.length} completed successfully`);
        } else {
          logger.warn(`⚠️ Wallet ${i + 1}/${publicKeys.length} failed`);
        }
        
        // Smart delay between requests - configurable
        if (i < publicKeys.length - 1) {
          const baseDelay = config.solana.faucetDelayMs;
          const delay = Math.min(baseDelay + (publicKeys.length * 500), 20000); // Max 20 seconds
          logger.info(`⏳ Waiting ${delay/1000}s before next wallet...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(`Failed to request airdrop for wallet ${i + 1}: ${publicKey}`, error);
        results.set(publicKey, false);
      }
    }
    
    const successCount = Array.from(results.values()).filter(success => success).length;
    logger.info(`🎉 SOL airdrop completed: ${successCount}/${publicKeys.length} successful`);
    
    return results;
  }

  public canRequestAirdrop(publicKey: string): boolean {
    const lastRequestTime = this.lastRequest.get(publicKey);
    if (!lastRequestTime) return true;
    
    const now = Date.now();
    return (now - lastRequestTime) >= this.RATE_LIMIT_MS;
  }

  public getTimeUntilNextRequest(publicKey: string): number {
    const lastRequestTime = this.lastRequest.get(publicKey);
    if (!lastRequestTime) return 0;
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    return Math.max(0, this.RATE_LIMIT_MS - timeSinceLastRequest);
  }

  public async validateConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      logger.info(`Connected to Solana cluster: ${version['solana-core']}`);
      return true;
    } catch (error) {
      logger.error('Failed to connect to Solana cluster', error);
      return false;
    }
  }

  private async tryWebFaucetWithRetry(publicKey: string, amount: number, maxRetries?: number): Promise<boolean> {
    maxRetries = maxRetries || config.solana.maxRetries;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🌐 Web faucet attempt ${attempt}/${maxRetries} for ${publicKey}`);
        
        const response = await axios.post(this.faucetUrl, {
          publicKey: publicKey,
          amount: amount * LAMPORTS_PER_SOL
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });

        if (response.status === 200) {
          logger.info(`✅ Successfully requested ${amount} SOL via web faucet for ${publicKey}`);
          return true;
        }
      } catch (webError: any) {
        if (webError?.response?.status === 429) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
          logger.warn(`⏰ Web faucet rate limit (attempt ${attempt}). Waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.warn(`Web faucet attempt ${attempt} failed: ${webError?.message || 'Unknown error'}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between attempts
          }
        }
      }
    }
    return false;
  }

  private async tryAlternativeFaucets(publicKey: string, amount: number): Promise<boolean> {
    const alternativeFaucets = [
      { url: 'https://api.devnet.solana.com/airdrop', name: 'Solana Devnet' },
      { url: 'https://faucet.solana.com/api/v1/airdrop', name: 'Solana Official' }
    ];

    for (let i = 0; i < alternativeFaucets.length; i++) {
      const faucet = alternativeFaucets[i];
      try {
        logger.info(`🔄 Trying ${faucet.name} faucet for ${publicKey}...`);
        
        const response = await axios.post(faucet.url, {
          account: publicKey,
          lamports: amount * LAMPORTS_PER_SOL
        }, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 200) {
          logger.info(`✅ Successfully requested ${amount} SOL via ${faucet.name} for ${publicKey}`);
          return true;
        }
      } catch (error: any) {
        logger.warn(`${faucet.name} faucet failed: ${error?.message || 'Unknown error'}`);
        
        // Add delay between different faucet attempts
        if (i < alternativeFaucets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    return false;
  }
}