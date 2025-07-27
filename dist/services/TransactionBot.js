"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBot = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class TransactionBot {
    provider;
    rpcUrls;
    currentRpcIndex = 0;
    transactionCount = 0;
    errorCount = 0;
    successCount = 0;
    rateLimit = new Map();
    constructor() {
        this.rpcUrls = [
            config_1.config.rome.rpcUrl,
            config_1.config.rome.martisRpcUrl,
            'https://caelian.testnet.romeprotocol.xyz/',
            'https://martis.testnet.romeprotocol.xyz/'
        ];
        this.provider = new ethers_1.ethers.JsonRpcProvider(this.rpcUrls[0]);
    }
    async switchRpc() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
        this.provider = new ethers_1.ethers.JsonRpcProvider(this.rpcUrls[this.currentRpcIndex]);
        logger_1.logger.info(`Switched to RPC: ${this.rpcUrls[this.currentRpcIndex]}`);
    }
    async checkRateLimit(address) {
        const now = Date.now();
        const lastTx = this.rateLimit.get(address);
        if (lastTx && (now - lastTx) < config_1.config.transactions.delayMs) {
            return false;
        }
        this.rateLimit.set(address, now);
        return true;
    }
    async sendTransaction(fromWallet, toAddress, amountInEth, data) {
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = this.rpcUrls.length;
        while (attempts < maxAttempts) {
            try {
                const wallet = new ethers_1.ethers.Wallet(fromWallet.evm.privateKey, this.provider);
                // Check rate limit
                if (!await this.checkRateLimit(wallet.address)) {
                    await new Promise(resolve => setTimeout(resolve, config_1.config.transactions.delayMs));
                }
                // Check balance
                const balance = await wallet.provider.getBalance(wallet.address);
                const amount = ethers_1.ethers.parseEther(amountInEth);
                if (balance < amount) {
                    throw new Error(`Insufficient balance: ${ethers_1.ethers.formatEther(balance)} ETH < ${amountInEth} ETH`);
                }
                // Get gas price and nonce
                const feeData = await wallet.provider.getFeeData();
                const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei');
                const nonce = await wallet.provider.getTransactionCount(wallet.address, 'pending');
                // Prepare transaction
                const tx = {
                    to: toAddress,
                    value: amount,
                    gasPrice: gasPrice,
                    nonce: nonce,
                    data: data || '0x'
                };
                // Estimate gas
                const gasEstimate = await wallet.provider.estimateGas(tx);
                tx.gasLimit = gasEstimate + 10000n; // Add buffer
                logger_1.logger.info(`Sending ${amountInEth} ETH from ${wallet.address} to ${toAddress}`);
                // Send transaction
                const response = await wallet.sendTransaction(tx);
                // Wait for confirmation
                const receipt = await response.wait(1);
                if (receipt && receipt.status === 1) {
                    this.successCount++;
                    this.transactionCount++;
                    logger_1.logger.info(`Transaction successful: ${receipt.hash} | Gas used: ${receipt.gasUsed}`);
                    return {
                        hash: receipt.hash,
                        success: true,
                        gasUsed: Number(receipt.gasUsed),
                        timestamp: startTime
                    };
                }
                else {
                    throw new Error('Transaction failed or was reverted');
                }
            }
            catch (error) {
                logger_1.logger.error(`Transaction attempt ${attempts + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
                attempts++;
                this.errorCount++;
                if (attempts < maxAttempts) {
                    await this.switchRpc();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return {
            hash: '',
            success: false,
            error: `Failed after ${maxAttempts} attempts`,
            timestamp: startTime
        };
    }
    async sendRandomTransactions(wallets, targetCount = config_1.config.transactions.maxTransactions, amountRange = { min: '0.001', max: '0.01' }) {
        const results = [];
        const batchSize = config_1.config.transactions.batchSize;
        logger_1.logger.info(`Starting mass transaction bot: ${targetCount} transactions`);
        for (let i = 0; i < targetCount; i += batchSize) {
            const batch = [];
            const batchEnd = Math.min(i + batchSize, targetCount);
            // Create batch of transactions
            for (let j = i; j < batchEnd; j++) {
                try {
                    const fromWallet = wallets[Math.floor(Math.random() * wallets.length)];
                    let toWallet = wallets[Math.floor(Math.random() * wallets.length)];
                    // Ensure we're not sending to the same wallet
                    if (fromWallet.evm.address === toWallet.evm.address) {
                        const toIndex = (wallets.indexOf(toWallet) + 1) % wallets.length;
                        toWallet = wallets[toIndex];
                    }
                    // Random amount between min and max
                    const minAmount = parseFloat(amountRange.min);
                    const maxAmount = parseFloat(amountRange.max);
                    const amount = (Math.random() * (maxAmount - minAmount) + minAmount).toFixed(6);
                    const txPromise = this.sendTransaction(fromWallet, toWallet.evm.address, amount);
                    batch.push(txPromise);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to create transaction ${j + 1}`, error);
                }
            }
            // Execute batch
            try {
                const batchResults = await Promise.allSettled(batch);
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    }
                    else {
                        results.push({
                            hash: '',
                            success: false,
                            error: result.reason.message,
                            timestamp: Date.now()
                        });
                    }
                }
                logger_1.logger.info(`Batch ${Math.floor(i / batchSize) + 1} completed: ${batchEnd - i} transactions`);
                logger_1.logger.info(`Progress: ${results.length}/${targetCount} | Success: ${this.successCount} | Errors: ${this.errorCount}`);
                // Delay between batches
                await new Promise(resolve => setTimeout(resolve, config_1.config.transactions.delayMs));
            }
            catch (error) {
                logger_1.logger.error(`Batch execution failed`, error);
            }
        }
        logger_1.logger.info(`Mass transaction completed: ${this.successCount}/${targetCount} successful`);
        return results;
    }
    async sendCircularTransactions(wallets, cycles, amountPerTx = '0.001') {
        const results = [];
        logger_1.logger.info(`Starting circular transactions: ${cycles} cycles with ${wallets.length} wallets`);
        for (let cycle = 0; cycle < cycles; cycle++) {
            for (let i = 0; i < wallets.length; i++) {
                try {
                    const fromWallet = wallets[i];
                    const toWallet = wallets[(i + 1) % wallets.length];
                    logger_1.logger.info(`Cycle ${cycle + 1}/${cycles}, Step ${i + 1}/${wallets.length}`);
                    const result = await this.sendTransaction(fromWallet, toWallet.evm.address, amountPerTx);
                    results.push(result);
                    // Small delay between transactions
                    await new Promise(resolve => setTimeout(resolve, config_1.config.transactions.delayMs));
                }
                catch (error) {
                    logger_1.logger.error(`Circular transaction failed: cycle ${cycle + 1}, step ${i + 1}`, error);
                    results.push({
                        hash: '',
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: Date.now()
                    });
                }
            }
            logger_1.logger.info(`Cycle ${cycle + 1} completed`);
        }
        return results;
    }
    async interactWithContracts(wallets, contractAddresses, interactionCount) {
        const results = [];
        // Simple contract interaction data (calling a function)
        const interactionData = [
            '0xa41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d48656c6c6f2c20576f726c642100000000000000000000000000000000000000', // setGreeting("Hello, World!")
            '0xa41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20526f6d652100000000000000000000000000000000000000000000', // setGreeting("Hello Rome!")
            '0xcfae3217' // greet() - view function
        ];
        logger_1.logger.info(`Starting contract interactions: ${interactionCount} interactions`);
        for (let i = 0; i < interactionCount; i++) {
            try {
                const wallet = wallets[Math.floor(Math.random() * wallets.length)];
                const contractAddress = contractAddresses[Math.floor(Math.random() * contractAddresses.length)];
                const data = interactionData[Math.floor(Math.random() * interactionData.length)];
                logger_1.logger.info(`Contract interaction ${i + 1}/${interactionCount}`);
                const result = await this.sendTransaction(wallet, contractAddress, '0', // No ETH transfer for contract calls
                data);
                results.push(result);
                // Delay between interactions
                await new Promise(resolve => setTimeout(resolve, config_1.config.transactions.delayMs));
            }
            catch (error) {
                logger_1.logger.error(`Contract interaction ${i + 1} failed`, error);
                results.push({
                    hash: '',
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                });
            }
        }
        return results;
    }
    async checkAllBalances(wallets) {
        const balances = new Map();
        for (const wallet of wallets) {
            try {
                const balance = await this.provider.getBalance(wallet.evm.address);
                balances.set(wallet.evm.address, ethers_1.ethers.formatEther(balance));
            }
            catch (error) {
                logger_1.logger.error(`Failed to check balance for ${wallet.evm.address}`, error);
                balances.set(wallet.evm.address, '0');
            }
        }
        return balances;
    }
    async distributeEther(sourceWallet, targetWallets, amountPerWallet) {
        const results = [];
        logger_1.logger.info(`Distributing ${amountPerWallet} ETH to ${targetWallets.length} wallets`);
        for (const targetWallet of targetWallets) {
            try {
                const result = await this.sendTransaction(sourceWallet, targetWallet.evm.address, amountPerWallet);
                results.push(result);
                // Delay between distributions
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                logger_1.logger.error(`Failed to distribute to ${targetWallet.evm.address}`, error);
                results.push({
                    hash: '',
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                });
            }
        }
        return results;
    }
    getStats() {
        const total = this.transactionCount + this.errorCount;
        const successRate = total > 0 ? (this.successCount / total) * 100 : 0;
        return {
            total,
            successful: this.successCount,
            failed: this.errorCount,
            successRate: parseFloat(successRate.toFixed(2))
        };
    }
    resetStats() {
        this.transactionCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.rateLimit.clear();
    }
    async optimizeGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            const currentGasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei');
            // Increase gas price by 10% for faster confirmation
            const optimizedGasPrice = (currentGasPrice * 110n) / 100n;
            logger_1.logger.info(`Optimized gas price: ${ethers_1.ethers.formatUnits(optimizedGasPrice, 'gwei')} gwei`);
            return optimizedGasPrice;
        }
        catch (error) {
            logger_1.logger.error('Failed to optimize gas price', error);
            return ethers_1.ethers.parseUnits('25', 'gwei'); // Fallback
        }
    }
}
exports.TransactionBot = TransactionBot;
//# sourceMappingURL=TransactionBot.js.map