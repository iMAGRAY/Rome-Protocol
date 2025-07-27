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
          logger.info(`Successfully requested ${amount} SOL via RPC for ${publicKey}`);
          return true;
        }
      } catch (rpcError) {
        logger.warn(`RPC airdrop failed for ${publicKey}, trying web faucet`);
      }

      // Method 2: Try web faucet
      try {
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
          this.lastRequest.set(publicKey, now);
          logger.info(`Successfully requested ${amount} SOL via web faucet for ${publicKey}`);
          return true;
        }
      } catch (webError) {
        logger.warn(`Web faucet failed for ${publicKey}`);
      }

      // Method 3: Try alternative faucet endpoints
      const alternativeFaucets = [
        'https://faucet.solana.com/api/v1/airdrop',
        'https://api.devnet.solana.com/airdrop',
      ];

      for (const faucetEndpoint of alternativeFaucets) {
        try {
          const response = await axios.post(faucetEndpoint, {
            account: publicKey,
            lamports: amount * LAMPORTS_PER_SOL
          }, {
            timeout: 15000
          });

          if (response.status === 200) {
            this.lastRequest.set(publicKey, now);
            logger.info(`Successfully requested ${amount} SOL via ${faucetEndpoint} for ${publicKey}`);
            return true;
          }
        } catch (error) {
          // Continue to next faucet
        }
      }

      logger.error(`All faucet methods failed for ${publicKey}`);
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
    
    for (const publicKey of publicKeys) {
      try {
        const success = await this.requestAirdrop(publicKey, amount);
        results.set(publicKey, success);
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Failed to request airdrop for ${publicKey}`, error);
        results.set(publicKey, false);
      }
    }
    
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
}