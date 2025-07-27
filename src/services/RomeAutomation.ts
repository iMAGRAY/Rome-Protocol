import { WalletManager } from './WalletManager';
import { SolanaFaucet } from './SolanaFaucet';
import { BrowserAutomation } from './BrowserAutomation';
import { ContractDeployer } from './ContractDeployer';
import { TransactionBot } from './TransactionBot';
import { GoogleFormsService } from './GoogleFormsService';
import { WalletPair, AutomationStats, ContractDeployResult, TransactionResult } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class RomeAutomation {
  private walletManager: WalletManager;
  private solanaFaucet: SolanaFaucet;
  private browserAutomation: BrowserAutomation;
  private contractDeployer: ContractDeployer;
  private transactionBot: TransactionBot;
  private googleFormsService: GoogleFormsService;
  private stats: AutomationStats;
  private wallets: WalletPair[] = [];
  private deployedContracts: string[] = [];

  constructor() {
    this.walletManager = new WalletManager();
    this.solanaFaucet = new SolanaFaucet();
    this.browserAutomation = new BrowserAutomation();
    this.contractDeployer = new ContractDeployer();
    this.transactionBot = new TransactionBot();
    this.googleFormsService = new GoogleFormsService();
    
    this.stats = {
      walletsCreated: 0,
      solanaBalance: 0,
      rSolBalance: 0,
      transactionsCompleted: 0,
      contractsDeployed: 0,
      bridgesCompleted: 0,
      errors: [],
      startTime: Date.now()
    };
  }

  // Step 1: Create wallets
  public async createWallets(count: number = 5): Promise<WalletPair[]> {
    try {
      logger.info(`Creating ${count} wallet pairs...`);
      
      const wallets = await this.walletManager.generateMultipleWallets(count);
      this.wallets = wallets;
      this.stats.walletsCreated = wallets.length;
      
      logger.info(`Successfully created ${wallets.length} wallet pairs`);
      
      // Log wallet addresses for reference
      for (const wallet of wallets) {
        logger.info(`Wallet: Solana ${wallet.solana.publicKey} | EVM ${wallet.evm.address}`);
      }
      
      return wallets;
    } catch (error) {
      const errorMsg = `Failed to create wallets: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      throw error;
    }
  }

  // Step 2: Request SOL from faucet
  public async requestSolanaFunds(): Promise<boolean> {
    try {
      logger.info('Requesting SOL from faucet for all wallets...');
      
      if (this.wallets.length === 0) {
        throw new Error('No wallets created yet');
      }

      const publicKeys = this.wallets.map(w => w.solana.publicKey);
      const results = await this.solanaFaucet.requestMultipleAirdrops(publicKeys, 2);
      
      let successCount = 0;
      let totalBalance = 0;

      for (const [publicKey, success] of results) {
        if (success) {
          successCount++;
          const balance = await this.solanaFaucet.getBalance(publicKey);
          totalBalance += balance;
          logger.info(`SOL received for ${publicKey}: ${balance} SOL`);
        } else {
          logger.warn(`Failed to get SOL for ${publicKey}`);
        }
      }

      this.stats.solanaBalance = totalBalance;
      logger.info(`SOL faucet completed: ${successCount}/${this.wallets.length} successful`);
      
      return successCount > 0;
    } catch (error) {
      const errorMsg = `Failed to request SOL funds: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return false;
    }
  }

  // Step 3: Connect to Rome Protocol website
  public async connectToRome(): Promise<boolean> {
    try {
      logger.info('Connecting to Rome Protocol website...');
      
      await this.browserAutomation.initializeBrowser();
      await this.browserAutomation.navigateToRome();
      
      // Connect the first wallet as primary
      if (this.wallets.length > 0) {
        const connected = await this.browserAutomation.connectWallets(this.wallets[0]);
        if (connected) {
          logger.info('Successfully connected to Rome Protocol');
          return true;
        }
      }
      
      throw new Error('Failed to connect wallets to Rome Protocol');
    } catch (error) {
      const errorMsg = `Failed to connect to Rome: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return false;
    }
  }

  // Step 4: Bridge SOL to rSOL
  public async bridgeSolToRSol(): Promise<boolean> {
    try {
      logger.info('Starting SOL to rSOL bridge process...');
      
      const bridgeResult = await this.browserAutomation.performBridge(1.0);
      
      if (bridgeResult.success) {
        this.stats.bridgesCompleted++;
        
        // Check rSOL balance
        const rSolBalance = await this.browserAutomation.checkRSolBalance();
        this.stats.rSolBalance = parseFloat(rSolBalance);
        
        logger.info(`Bridge successful! rSOL balance: ${rSolBalance}`);
        return true;
      } else {
        throw new Error(bridgeResult.error || 'Bridge operation failed');
      }
    } catch (error) {
      const errorMsg = `Failed to bridge SOL to rSOL: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return false;
    }
  }

  // Step 5: Deploy HelloWorld contracts
  public async deployContracts(contractsPerWallet: number = 1): Promise<ContractDeployResult[]> {
    try {
      logger.info(`Deploying contracts: ${contractsPerWallet} per wallet...`);
      
      const results: ContractDeployResult[] = [];
      
      for (const wallet of this.wallets) {
        for (let i = 0; i < contractsPerWallet; i++) {
          try {
            const result = await this.contractDeployer.deployHelloWorld(wallet);
            results.push(result);
            
            if (result.success) {
              this.deployedContracts.push(result.address);
              this.stats.contractsDeployed++;
              logger.info(`Contract deployed at ${result.address} by ${wallet.evm.address}`);
            }
            
            // Delay between deployments
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            logger.error(`Contract deployment failed for wallet ${wallet.evm.address}`, error);
          }
        }
      }
      
      logger.info(`Contract deployment completed: ${this.stats.contractsDeployed} contracts deployed`);
      return results;
    } catch (error) {
      const errorMsg = `Failed to deploy contracts: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return [];
    }
  }

  // Step 6: Execute mass transactions
  public async executeMassTransactions(targetCount: number = config.transactions.maxTransactions): Promise<TransactionResult[]> {
    try {
      logger.info(`Starting mass transaction execution: ${targetCount} transactions...`);
      
      if (this.wallets.length < 2) {
        throw new Error('Need at least 2 wallets for mass transactions');
      }

      // Method 1: Random transactions between wallets
      const randomTxResults = await this.transactionBot.sendRandomTransactions(
        this.wallets,
        Math.floor(targetCount * 0.7) // 70% random transactions
      );

      // Method 2: Circular transactions
      const circularTxResults = await this.transactionBot.sendCircularTransactions(
        this.wallets,
        Math.floor(targetCount * 0.2 / this.wallets.length) // 20% circular
      );

      // Method 3: Contract interactions if contracts are deployed
      let contractTxResults: TransactionResult[] = [];
      if (this.deployedContracts.length > 0) {
        contractTxResults = await this.transactionBot.interactWithContracts(
          this.wallets,
          this.deployedContracts,
          Math.floor(targetCount * 0.1) // 10% contract interactions
        );
      }

      const allResults = [...randomTxResults, ...circularTxResults, ...contractTxResults];
      const successfulTx = allResults.filter(result => result.success).length;
      
      this.stats.transactionsCompleted = successfulTx;
      
      logger.info(`Mass transactions completed: ${successfulTx}/${allResults.length} successful`);
      return allResults;
    } catch (error) {
      const errorMsg = `Failed to execute mass transactions: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return [];
    }
  }

  // Step 7: Submit reward forms
  public async submitRewardForms(): Promise<boolean> {
    try {
      logger.info('Submitting reward forms...');
      
      const addresses = this.wallets.map(w => w.evm.address);
      const txCounts = new Array(addresses.length).fill(Math.floor(this.stats.transactionsCompleted / addresses.length));
      
      const results = await this.googleFormsService.submitMultipleForms(addresses, txCounts);
      
      const successCount = Array.from(results.values()).filter(Boolean).length;
      logger.info(`Reward forms submitted: ${successCount}/${addresses.length} successful`);
      
      return successCount > 0;
    } catch (error) {
      const errorMsg = `Failed to submit reward forms: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      return false;
    }
  }

  // Execute full automation sequence
  public async executeFullAutomation(options: {
    walletCount?: number;
    contractsPerWallet?: number;
    targetTransactions?: number;
    submitForms?: boolean;
  } = {}): Promise<AutomationStats> {
    const {
      walletCount = 5,
      contractsPerWallet = 1,
      targetTransactions = config.transactions.maxTransactions,
      submitForms = true
    } = options;

    try {
      logger.info('Starting full Rome Protocol automation...');
      this.stats.startTime = Date.now();

      // Step 1: Create wallets
      await this.createWallets(walletCount);
      await this.saveProgress();

      // Step 2: Request SOL
      await this.requestSolanaFunds();
      await this.saveProgress();

      // Step 3: Connect to Rome
      await this.connectToRome();
      await this.saveProgress();

      // Step 4: Bridge SOL to rSOL
      await this.bridgeSolToRSol();
      await this.saveProgress();

      // Step 5: Deploy contracts (optional)
      if (contractsPerWallet > 0) {
        await this.deployContracts(contractsPerWallet);
        await this.saveProgress();
      }

      // Step 6: Mass transactions
      await this.executeMassTransactions(targetTransactions);
      await this.saveProgress();

      // Step 7: Submit forms (optional)
      if (submitForms) {
        await this.submitRewardForms();
      }

      this.stats.endTime = Date.now();
      await this.saveProgress();

      logger.info('Full automation completed successfully!');
      this.logFinalStats();

      return this.stats;
    } catch (error) {
      const errorMsg = `Full automation failed: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      
      this.stats.endTime = Date.now();
      await this.saveProgress();
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // Error handling and retry logic
  public async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 5000
  ): Promise<T> {
    let lastError: Error | unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : String(error)}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError;
  }

  // Save progress to file
  private async saveProgress(): Promise<void> {
    try {
      const progressDir = path.join(process.cwd(), 'progress');
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }

      const progressData = {
        stats: this.stats,
        wallets: this.wallets.map(w => ({
          solana: w.solana.publicKey,
          evm: w.evm.address
        })),
        deployedContracts: this.deployedContracts,
        timestamp: new Date().toISOString()
      };

      const filename = `progress_${Date.now()}.json`;
      const filepath = path.join(progressDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(progressData, null, 2));
      logger.info(`Progress saved to ${filepath}`);
    } catch (error) {
      logger.error('Failed to save progress', error);
    }
  }

  // Load previous progress
  public async loadProgress(filepath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filepath)) {
        return false;
      }

      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      this.stats = { ...this.stats, ...data.stats };
      this.deployedContracts = data.deployedContracts || [];
      
      logger.info('Progress loaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to load progress', error);
      return false;
    }
  }

  // Get current statistics
  public getStats(): AutomationStats {
    return { ...this.stats };
  }

  // Log final statistics
  private logFinalStats(): void {
    const duration = this.stats.endTime ? (this.stats.endTime - this.stats.startTime) / 1000 : 0;
    
    logger.info('=== FINAL AUTOMATION STATISTICS ===');
    logger.info(`Duration: ${duration.toFixed(2)} seconds`);
    logger.info(`Wallets Created: ${this.stats.walletsCreated}`);
    logger.info(`Solana Balance: ${this.stats.solanaBalance} SOL`);
    logger.info(`rSOL Balance: ${this.stats.rSolBalance} rSOL`);
    logger.info(`Bridges Completed: ${this.stats.bridgesCompleted}`);
    logger.info(`Contracts Deployed: ${this.stats.contractsDeployed}`);
    logger.info(`Transactions Completed: ${this.stats.transactionsCompleted}`);
    logger.info(`Errors: ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      logger.info('Errors encountered:');
      this.stats.errors.forEach((error, index) => {
        logger.info(`  ${index + 1}. ${error}`);
      });
    }
  }

  // Cleanup resources
  public async cleanup(): Promise<void> {
    try {
      await this.browserAutomation.close();
      logger.info('Automation cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup automation', error);
    }
  }

  // Health check
  public async healthCheck(): Promise<{ [key: string]: boolean }> {
    const checks = {
      solanaConnection: false,
      romeConnection: false,
      walletManager: false,
      configValid: false
    };

    try {
      // Check Solana connection
      checks.solanaConnection = await this.solanaFaucet.validateConnection();
      
      // Check Rome connection
      checks.romeConnection = await this.contractDeployer.validateConnection();
      
      // Check wallet manager
      checks.walletManager = true; // Wallet manager is always available
      
      // Check config
      checks.configValid = config.rome.rpcUrl !== '' && config.solana.rpcUrl !== '';
      
      logger.info('Health check completed', checks);
    } catch (error) {
      logger.error('Health check failed', error);
    }

    return checks;
  }
}