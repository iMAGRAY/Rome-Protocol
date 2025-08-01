import { WalletManager } from './WalletManager';
import { SolanaFaucet } from './SolanaFaucet';
import { BrowserAutomation } from './BrowserAutomation';
import { ContractDeployer } from './ContractDeployer';
import { TransactionBot } from './TransactionBot';
import { GoogleFormsService } from './GoogleFormsService';
import { ExcelStats } from './ExcelStats';
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
  private excelStats: ExcelStats;
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
    this.excelStats = new ExcelStats();
    
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

    // Load existing Excel data if available
    this.excelStats.loadExistingData().catch(error => {
      logger.warn('Не удалось загрузить существующие Excel данные:', error);
    });
  }

  // Step 1: Create wallets
  public async createWallets(count: number = 5): Promise<WalletPair[]> {
    try {
      logger.info(`Creating ${count} wallet pairs...`);
      
      const wallets = await this.walletManager.generateMultipleWallets(count);
      this.wallets = wallets;
      this.stats.walletsCreated = wallets.length;
      
      logger.info(`Successfully created ${wallets.length} wallet pairs`);
      
      // Log wallet addresses for reference and add to Excel
      for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        logger.info(`Wallet: Solana ${wallet.solana.publicKey} | EVM ${wallet.evm.address}`);
        this.excelStats.addWallet(wallet, i);
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
            
            // Update balance in Excel
            this.excelStats.updateWalletBalance(publicKey, balance, '0');
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
              
              // Add contract to Excel
              this.excelStats.addContract(result, wallet.evm.address);
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

  // Step 6: Start continuous random activity
  public async startRandomActivity(): Promise<void> {
    try {
      logger.info('Starting continuous random blockchain activity...');
      
      if (this.wallets.length < 2) {
        throw new Error('Need at least 2 wallets for random activity');
      }

              // Start background activity that runs indefinitely
        logger.info('Random activity started in background');
        
        // Don't await - let it run in background
        this.runRandomActivity().catch(error => {
          logger.error('Random activity crashed:', error);
        });
    } catch (error) {
      const errorMsg = `Failed to start random activity: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }
  }

  private async runRandomActivity(): Promise<void> {
    const activities = [
      'randomTransfer',
      'contractInteraction', 
      'contractDeployment',
      'multiTransfer',
      'contractCall',
      'balanceCheck'
    ];

          while (true) {
        try {
          // Random delay from config
          const delayMs = Math.random() * (config.activity.maxDelayMs - config.activity.minDelayMs) + config.activity.minDelayMs;
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Pick random activity
        const activity = activities[Math.floor(Math.random() * activities.length)];
        const wallet = this.wallets[Math.floor(Math.random() * this.wallets.length)];

        logger.info(`Executing random activity: ${activity} with wallet ${wallet.evm.address}`);

        switch (activity) {
          case 'randomTransfer':
            await this.executeRandomTransfer(wallet);
            break;
          case 'contractInteraction':
            await this.executeRandomContractInteraction(wallet);
            break;
          case 'contractDeployment':
            await this.executeRandomContractDeployment(wallet);
            break;
          case 'multiTransfer':
            await this.executeMultiTransfer(wallet);
            break;
          case 'contractCall':
            await this.executeRandomContractCall(wallet);
            break;
          case 'balanceCheck':
            await this.executeBalanceCheck(wallet);
            break;
        }

        this.stats.transactionsCompleted++;
        
      } catch (error) {
        logger.warn('Random activity error (continuing):', error);
        this.stats.errors.push(`Random activity error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async executeRandomTransfer(fromWallet: WalletPair): Promise<void> {
    const toWallet = this.wallets.find(w => w.evm.address !== fromWallet.evm.address);
    if (!toWallet) return;

    const amount = (Math.random() * (config.activity.maxAmount - config.activity.minAmount) + config.activity.minAmount).toFixed(6);
    
    const result = await this.transactionBot.sendTransaction(
      fromWallet,
      toWallet.evm.address,
      amount
    );
    
    // Add transaction to Excel
    this.excelStats.addTransaction(result, fromWallet.evm.address, toWallet.evm.address, amount, 'Случайный перевод');
    
    logger.info(`Random transfer: ${amount} ETH from ${fromWallet.evm.address} to ${toWallet.evm.address}`);
  }

  private async executeRandomContractInteraction(wallet: WalletPair): Promise<void> {
    if (this.deployedContracts.length === 0) return;
    
    const contractAddress = this.deployedContracts[Math.floor(Math.random() * this.deployedContracts.length)];
    const interactions = [
      '0xa41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d48656c6c6f2c20576f726c642100000000000000000000000000000000000000', // setGreeting("Hello, World!")
      '0xa41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20526f6d652100000000000000000000000000000000000000000000', // setGreeting("Hello Rome!")
      '0xe21f37ce', // ping()
      '0x5c975abb0000000000000000000000000000000000000000000000000000000000000005', // batchPing(5)
      '0x9061b923', // toggleGreeting()
      '0x84c84b9100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526f6d652050726f746f636f6c20526f636b73210000000000000000000000', // storeMessage("Rome Protocol Rocks!")
      '0xefbe1c1c' // getRandomNumber()
    ];
    
    const data = interactions[Math.floor(Math.random() * interactions.length)];
    
    const result = await this.transactionBot.sendTransaction(
      wallet,
      contractAddress,
      '0',
      data
    );
    
    // Add contract interaction to Excel
    this.excelStats.addTransaction(result, wallet.evm.address, contractAddress, '0', 'Взаимодействие с контрактом');
    this.excelStats.addContractInteraction(contractAddress);
    
    logger.info(`Random contract interaction with ${contractAddress}`);
  }

  private async executeRandomContractDeployment(wallet: WalletPair): Promise<void> {
    const result = await this.contractDeployer.deployHelloWorld(wallet);
    
    if (result.success) {
      this.deployedContracts.push(result.address);
      this.stats.contractsDeployed++;
      logger.info(`Random contract deployed at ${result.address}`);
      
      // Add contract to Excel
      this.excelStats.addContract(result, wallet.evm.address);
    }
  }

  private async executeMultiTransfer(fromWallet: WalletPair): Promise<void> {
    const recipients = this.wallets.filter(w => w.evm.address !== fromWallet.evm.address);
    const numTransfers = Math.min(Math.floor(Math.random() * 3) + 1, recipients.length);
    
    for (let i = 0; i < numTransfers; i++) {
      const recipient = recipients[Math.floor(Math.random() * recipients.length)];
      const amount = (Math.random() * 0.005 + 0.0001).toFixed(6);
      
      const result = await this.transactionBot.sendTransaction(
        fromWallet,
        recipient.evm.address,
        amount
      );
      
      // Add transaction to Excel
      this.excelStats.addTransaction(result, fromWallet.evm.address, recipient.evm.address, amount, 'Мульти-перевод');
      
      // Small delay between transfers
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    logger.info(`Multi-transfer: ${numTransfers} transfers from ${fromWallet.evm.address}`);
  }

  private async executeRandomContractCall(wallet: WalletPair): Promise<void> {
    if (this.deployedContracts.length === 0) return;
    
    const contractAddress = this.deployedContracts[Math.floor(Math.random() * this.deployedContracts.length)];
    
    // Random greeting message
    const greetings = [
      'Hello Rome Protocol!',
      'Greetings from automation!',
      'Testing smart contracts',
      'Random activity ongoing',
      'Blockchain interaction test'
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const success = await this.contractDeployer.interactWithContract(contractAddress, wallet, greeting);
    
    // Add contract call to Excel (as a transaction-like entry)
    const dummyResult = {
      hash: 'contract-call-' + Date.now(),
      success: success,
      timestamp: Date.now()
    };
    this.excelStats.addTransaction(dummyResult as any, wallet.evm.address, contractAddress, '0', 'Вызов контракта');
    this.excelStats.addContractInteraction(contractAddress);
    
    logger.info(`Random contract call: set greeting to "${greeting}"`);
  }

  private async executeBalanceCheck(wallet: WalletPair): Promise<void> {
    const balances = await this.walletManager.checkBalances(wallet);
    
    // Update balances in Excel
    this.excelStats.updateWalletBalance(wallet.evm.address, balances.solBalance, balances.evmBalance);
    
    // Add balance check activity to Excel
    const dummyResult = {
      hash: 'balance-check-' + Date.now(),
      success: true,
      timestamp: Date.now()
    };
    this.excelStats.addTransaction(dummyResult as any, wallet.evm.address, wallet.evm.address, '0', 'Проверка баланса');
    
    logger.info(`Balance check for ${wallet.evm.address}: SOL ${balances.solBalance}, ETH ${balances.evmBalance}`);
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
    startRandomActivity?: boolean;
    submitForms?: boolean;
  } = {}): Promise<AutomationStats> {
    const {
      walletCount = 5,
      contractsPerWallet = 1,
      startRandomActivity = true,
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

      // Step 6: Start random activity (non-blocking)
      if (startRandomActivity) {
        await this.startRandomActivity();
        logger.info('Random activity running in background...');
        
        // Let it run for a bit to show some activity
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
        await this.saveProgress();
      }

      // Step 7: Submit forms (optional)
      if (submitForms) {
        await this.submitRewardForms();
      }

      this.stats.endTime = Date.now();
      await this.saveProgress();

      // Initialize and save Excel statistics
      try {
        this.excelStats.initializeSummary(this.stats);
        await this.excelStats.saveToExcel();
        const excelStats = this.excelStats.getStats();
        logger.info(`📊 Excel статистика создана: ${excelStats.filePath}`);
        logger.info(`📊 Данные: кошельков ${excelStats.wallets}, транзакций ${excelStats.transactions}, контрактов ${excelStats.contracts}`);
      } catch (error) {
        logger.error('Ошибка создания Excel статистики:', error);
      }

      logger.info('Full automation completed successfully!');
      this.logFinalStats();

      return this.stats;
    } catch (error) {
      const errorMsg = `Full automation failed: ${error instanceof Error ? error.message : String(error)}`;
      this.stats.errors.push(errorMsg);
      logger.error(errorMsg, error);
      
      this.stats.endTime = Date.now();
      await this.saveProgress();
      
      // Save Excel even on error
      try {
        this.excelStats.initializeSummary(this.stats);
        await this.excelStats.saveToExcel();
        logger.info('📊 Excel статистика сохранена даже при ошибке');
      } catch (excelError) {
        logger.error('Не удалось сохранить Excel при ошибке:', excelError);
      }
      
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
      browserInstalled: false,
      walletManager: false,
      configValid: false
    };

    try {
      // Check Solana connection
      checks.solanaConnection = await this.solanaFaucet.validateConnection();
      
      // Check Rome connection
      checks.romeConnection = await this.contractDeployer.validateConnection();
      
      // Check browser installation
      checks.browserInstalled = await this.checkBrowsers();
      
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

  private async checkBrowsers(): Promise<boolean> {
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      return true;
    } catch (error: any) {
      if (error.message.includes("Executable doesn't exist")) {
        logger.warn('Playwright browsers not installed - will auto-install when needed');
        return false;
      }
      return true;
    }
  }
}