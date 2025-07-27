"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RomeAutomation = void 0;
const WalletManager_1 = require("./WalletManager");
const SolanaFaucet_1 = require("./SolanaFaucet");
const BrowserAutomation_1 = require("./BrowserAutomation");
const ContractDeployer_1 = require("./ContractDeployer");
const TransactionBot_1 = require("./TransactionBot");
const GoogleFormsService_1 = require("./GoogleFormsService");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class RomeAutomation {
    walletManager;
    solanaFaucet;
    browserAutomation;
    contractDeployer;
    transactionBot;
    googleFormsService;
    stats;
    wallets = [];
    deployedContracts = [];
    constructor() {
        this.walletManager = new WalletManager_1.WalletManager();
        this.solanaFaucet = new SolanaFaucet_1.SolanaFaucet();
        this.browserAutomation = new BrowserAutomation_1.BrowserAutomation();
        this.contractDeployer = new ContractDeployer_1.ContractDeployer();
        this.transactionBot = new TransactionBot_1.TransactionBot();
        this.googleFormsService = new GoogleFormsService_1.GoogleFormsService();
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
    async createWallets(count = 5) {
        try {
            logger_1.logger.info(`Creating ${count} wallet pairs...`);
            const wallets = await this.walletManager.generateMultipleWallets(count);
            this.wallets = wallets;
            this.stats.walletsCreated = wallets.length;
            logger_1.logger.info(`Successfully created ${wallets.length} wallet pairs`);
            // Log wallet addresses for reference
            for (const wallet of wallets) {
                logger_1.logger.info(`Wallet: Solana ${wallet.solana.publicKey} | EVM ${wallet.evm.address}`);
            }
            return wallets;
        }
        catch (error) {
            const errorMsg = `Failed to create wallets: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            throw error;
        }
    }
    // Step 2: Request SOL from faucet
    async requestSolanaFunds() {
        try {
            logger_1.logger.info('Requesting SOL from faucet for all wallets...');
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
                    logger_1.logger.info(`SOL received for ${publicKey}: ${balance} SOL`);
                }
                else {
                    logger_1.logger.warn(`Failed to get SOL for ${publicKey}`);
                }
            }
            this.stats.solanaBalance = totalBalance;
            logger_1.logger.info(`SOL faucet completed: ${successCount}/${this.wallets.length} successful`);
            return successCount > 0;
        }
        catch (error) {
            const errorMsg = `Failed to request SOL funds: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return false;
        }
    }
    // Step 3: Connect to Rome Protocol website
    async connectToRome() {
        try {
            logger_1.logger.info('Connecting to Rome Protocol website...');
            await this.browserAutomation.initializeBrowser();
            await this.browserAutomation.navigateToRome();
            // Connect the first wallet as primary
            if (this.wallets.length > 0) {
                const connected = await this.browserAutomation.connectWallets(this.wallets[0]);
                if (connected) {
                    logger_1.logger.info('Successfully connected to Rome Protocol');
                    return true;
                }
            }
            throw new Error('Failed to connect wallets to Rome Protocol');
        }
        catch (error) {
            const errorMsg = `Failed to connect to Rome: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return false;
        }
    }
    // Step 4: Bridge SOL to rSOL
    async bridgeSolToRSol() {
        try {
            logger_1.logger.info('Starting SOL to rSOL bridge process...');
            const bridgeResult = await this.browserAutomation.performBridge(1.0);
            if (bridgeResult.success) {
                this.stats.bridgesCompleted++;
                // Check rSOL balance
                const rSolBalance = await this.browserAutomation.checkRSolBalance();
                this.stats.rSolBalance = parseFloat(rSolBalance);
                logger_1.logger.info(`Bridge successful! rSOL balance: ${rSolBalance}`);
                return true;
            }
            else {
                throw new Error(bridgeResult.error || 'Bridge operation failed');
            }
        }
        catch (error) {
            const errorMsg = `Failed to bridge SOL to rSOL: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return false;
        }
    }
    // Step 5: Deploy HelloWorld contracts
    async deployContracts(contractsPerWallet = 1) {
        try {
            logger_1.logger.info(`Deploying contracts: ${contractsPerWallet} per wallet...`);
            const results = [];
            for (const wallet of this.wallets) {
                for (let i = 0; i < contractsPerWallet; i++) {
                    try {
                        const result = await this.contractDeployer.deployHelloWorld(wallet);
                        results.push(result);
                        if (result.success) {
                            this.deployedContracts.push(result.address);
                            this.stats.contractsDeployed++;
                            logger_1.logger.info(`Contract deployed at ${result.address} by ${wallet.evm.address}`);
                        }
                        // Delay between deployments
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    catch (error) {
                        logger_1.logger.error(`Contract deployment failed for wallet ${wallet.evm.address}`, error);
                    }
                }
            }
            logger_1.logger.info(`Contract deployment completed: ${this.stats.contractsDeployed} contracts deployed`);
            return results;
        }
        catch (error) {
            const errorMsg = `Failed to deploy contracts: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return [];
        }
    }
    // Step 6: Execute mass transactions
    async executeMassTransactions(targetCount = config_1.config.transactions.maxTransactions) {
        try {
            logger_1.logger.info(`Starting mass transaction execution: ${targetCount} transactions...`);
            if (this.wallets.length < 2) {
                throw new Error('Need at least 2 wallets for mass transactions');
            }
            // Method 1: Random transactions between wallets
            const randomTxResults = await this.transactionBot.sendRandomTransactions(this.wallets, Math.floor(targetCount * 0.7) // 70% random transactions
            );
            // Method 2: Circular transactions
            const circularTxResults = await this.transactionBot.sendCircularTransactions(this.wallets, Math.floor(targetCount * 0.2 / this.wallets.length) // 20% circular
            );
            // Method 3: Contract interactions if contracts are deployed
            let contractTxResults = [];
            if (this.deployedContracts.length > 0) {
                contractTxResults = await this.transactionBot.interactWithContracts(this.wallets, this.deployedContracts, Math.floor(targetCount * 0.1) // 10% contract interactions
                );
            }
            const allResults = [...randomTxResults, ...circularTxResults, ...contractTxResults];
            const successfulTx = allResults.filter(result => result.success).length;
            this.stats.transactionsCompleted = successfulTx;
            logger_1.logger.info(`Mass transactions completed: ${successfulTx}/${allResults.length} successful`);
            return allResults;
        }
        catch (error) {
            const errorMsg = `Failed to execute mass transactions: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return [];
        }
    }
    // Step 7: Submit reward forms
    async submitRewardForms() {
        try {
            logger_1.logger.info('Submitting reward forms...');
            const addresses = this.wallets.map(w => w.evm.address);
            const txCounts = new Array(addresses.length).fill(Math.floor(this.stats.transactionsCompleted / addresses.length));
            const results = await this.googleFormsService.submitMultipleForms(addresses, txCounts);
            const successCount = Array.from(results.values()).filter(Boolean).length;
            logger_1.logger.info(`Reward forms submitted: ${successCount}/${addresses.length} successful`);
            return successCount > 0;
        }
        catch (error) {
            const errorMsg = `Failed to submit reward forms: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            return false;
        }
    }
    // Execute full automation sequence
    async executeFullAutomation(options = {}) {
        const { walletCount = 5, contractsPerWallet = 1, targetTransactions = config_1.config.transactions.maxTransactions, submitForms = true } = options;
        try {
            logger_1.logger.info('Starting full Rome Protocol automation...');
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
            logger_1.logger.info('Full automation completed successfully!');
            this.logFinalStats();
            return this.stats;
        }
        catch (error) {
            const errorMsg = `Full automation failed: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
            this.stats.endTime = Date.now();
            await this.saveProgress();
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    // Error handling and retry logic
    async retryOperation(operation, maxRetries = 3, delayMs = 5000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                logger_1.logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}): ${error instanceof Error ? error.message : String(error)}`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        throw lastError;
    }
    // Save progress to file
    async saveProgress() {
        try {
            const progressDir = path_1.default.join(process.cwd(), 'progress');
            if (!fs_1.default.existsSync(progressDir)) {
                fs_1.default.mkdirSync(progressDir, { recursive: true });
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
            const filepath = path_1.default.join(progressDir, filename);
            fs_1.default.writeFileSync(filepath, JSON.stringify(progressData, null, 2));
            logger_1.logger.info(`Progress saved to ${filepath}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to save progress', error);
        }
    }
    // Load previous progress
    async loadProgress(filepath) {
        try {
            if (!fs_1.default.existsSync(filepath)) {
                return false;
            }
            const data = JSON.parse(fs_1.default.readFileSync(filepath, 'utf8'));
            this.stats = { ...this.stats, ...data.stats };
            this.deployedContracts = data.deployedContracts || [];
            logger_1.logger.info('Progress loaded successfully');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to load progress', error);
            return false;
        }
    }
    // Get current statistics
    getStats() {
        return { ...this.stats };
    }
    // Log final statistics
    logFinalStats() {
        const duration = this.stats.endTime ? (this.stats.endTime - this.stats.startTime) / 1000 : 0;
        logger_1.logger.info('=== FINAL AUTOMATION STATISTICS ===');
        logger_1.logger.info(`Duration: ${duration.toFixed(2)} seconds`);
        logger_1.logger.info(`Wallets Created: ${this.stats.walletsCreated}`);
        logger_1.logger.info(`Solana Balance: ${this.stats.solanaBalance} SOL`);
        logger_1.logger.info(`rSOL Balance: ${this.stats.rSolBalance} rSOL`);
        logger_1.logger.info(`Bridges Completed: ${this.stats.bridgesCompleted}`);
        logger_1.logger.info(`Contracts Deployed: ${this.stats.contractsDeployed}`);
        logger_1.logger.info(`Transactions Completed: ${this.stats.transactionsCompleted}`);
        logger_1.logger.info(`Errors: ${this.stats.errors.length}`);
        if (this.stats.errors.length > 0) {
            logger_1.logger.info('Errors encountered:');
            this.stats.errors.forEach((error, index) => {
                logger_1.logger.info(`  ${index + 1}. ${error}`);
            });
        }
    }
    // Cleanup resources
    async cleanup() {
        try {
            await this.browserAutomation.close();
            logger_1.logger.info('Automation cleanup completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup automation', error);
        }
    }
    // Health check
    async healthCheck() {
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
            checks.configValid = config_1.config.rome.rpcUrl !== '' && config_1.config.solana.rpcUrl !== '';
            logger_1.logger.info('Health check completed', checks);
        }
        catch (error) {
            logger_1.logger.error('Health check failed', error);
        }
        return checks;
    }
}
exports.RomeAutomation = RomeAutomation;
//# sourceMappingURL=RomeAutomation.js.map