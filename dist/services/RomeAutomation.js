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
    // Step 6: Start continuous random activity
    async startRandomActivity() {
        try {
            logger_1.logger.info('Starting continuous random blockchain activity...');
            if (this.wallets.length < 2) {
                throw new Error('Need at least 2 wallets for random activity');
            }
            // Start background activity that runs indefinitely
            logger_1.logger.info('Random activity started in background');
            // Don't await - let it run in background
            this.runRandomActivity().catch(error => {
                logger_1.logger.error('Random activity crashed:', error);
            });
        }
        catch (error) {
            const errorMsg = `Failed to start random activity: ${error instanceof Error ? error.message : String(error)}`;
            this.stats.errors.push(errorMsg);
            logger_1.logger.error(errorMsg, error);
        }
    }
    async runRandomActivity() {
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
                // Random delay between 30 seconds to 5 minutes
                const delayMs = Math.random() * (5 * 60 * 1000 - 30 * 1000) + 30 * 1000;
                await new Promise(resolve => setTimeout(resolve, delayMs));
                // Pick random activity
                const activity = activities[Math.floor(Math.random() * activities.length)];
                const wallet = this.wallets[Math.floor(Math.random() * this.wallets.length)];
                logger_1.logger.info(`Executing random activity: ${activity} with wallet ${wallet.evm.address}`);
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
            }
            catch (error) {
                logger_1.logger.warn('Random activity error (continuing):', error);
                this.stats.errors.push(`Random activity error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    async executeRandomTransfer(fromWallet) {
        const toWallet = this.wallets.find(w => w.evm.address !== fromWallet.evm.address);
        if (!toWallet)
            return;
        const amount = (Math.random() * 0.01 + 0.001).toFixed(6); // 0.001-0.011 ETH
        await this.transactionBot.sendTransaction(fromWallet, toWallet.evm.address, amount);
        logger_1.logger.info(`Random transfer: ${amount} ETH from ${fromWallet.evm.address} to ${toWallet.evm.address}`);
    }
    async executeRandomContractInteraction(wallet) {
        if (this.deployedContracts.length === 0)
            return;
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
        await this.transactionBot.sendTransaction(wallet, contractAddress, '0', data);
        logger_1.logger.info(`Random contract interaction with ${contractAddress}`);
    }
    async executeRandomContractDeployment(wallet) {
        const result = await this.contractDeployer.deployHelloWorld(wallet);
        if (result.success) {
            this.deployedContracts.push(result.address);
            this.stats.contractsDeployed++;
            logger_1.logger.info(`Random contract deployed at ${result.address}`);
        }
    }
    async executeMultiTransfer(fromWallet) {
        const recipients = this.wallets.filter(w => w.evm.address !== fromWallet.evm.address);
        const numTransfers = Math.min(Math.floor(Math.random() * 3) + 1, recipients.length);
        for (let i = 0; i < numTransfers; i++) {
            const recipient = recipients[Math.floor(Math.random() * recipients.length)];
            const amount = (Math.random() * 0.005 + 0.0001).toFixed(6);
            await this.transactionBot.sendTransaction(fromWallet, recipient.evm.address, amount);
            // Small delay between transfers
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        logger_1.logger.info(`Multi-transfer: ${numTransfers} transfers from ${fromWallet.evm.address}`);
    }
    async executeRandomContractCall(wallet) {
        if (this.deployedContracts.length === 0)
            return;
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
        await this.contractDeployer.interactWithContract(contractAddress, wallet, greeting);
        logger_1.logger.info(`Random contract call: set greeting to "${greeting}"`);
    }
    async executeBalanceCheck(wallet) {
        const balances = await this.walletManager.checkBalances(wallet);
        logger_1.logger.info(`Balance check for ${wallet.evm.address}: SOL ${balances.solBalance}, ETH ${balances.evmBalance}`);
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
        const { walletCount = 5, contractsPerWallet = 1, startRandomActivity = true, submitForms = true } = options;
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
            // Step 6: Start random activity (non-blocking)
            if (startRandomActivity) {
                await this.startRandomActivity();
                logger_1.logger.info('Random activity running in background...');
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