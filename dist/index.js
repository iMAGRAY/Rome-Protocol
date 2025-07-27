#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RomeAutomation_1 = require("./services/RomeAutomation");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
async function main() {
    console.log('🚀 Rome Protocol Automation Bot v1.0');
    console.log('=====================================');
    try {
        // Validate configuration
        if (!(0, config_1.validateConfig)()) {
            console.error('❌ Configuration validation failed');
            process.exit(1);
        }
        console.log('✅ Configuration validated');
        // Initialize automation
        const automation = new RomeAutomation_1.RomeAutomation();
        // Health check
        console.log('🔍 Running health check...');
        const healthStatus = await automation.healthCheck();
        for (const [check, status] of Object.entries(healthStatus)) {
            console.log(`${status ? '✅' : '❌'} ${check}: ${status ? 'OK' : 'FAILED'}`);
        }
        const allHealthy = Object.values(healthStatus).every(Boolean);
        if (!allHealthy) {
            console.warn('⚠️  Some health checks failed, but continuing...');
        }
        // Parse command line arguments
        const args = process.argv.slice(2);
        const options = parseArguments(args);
        console.log('📊 Automation Options:');
        console.log(`   Wallets: ${options.walletCount}`);
        console.log(`   Contracts per wallet: ${options.contractsPerWallet}`);
        console.log(`   Random activity: ${options.startRandomActivity ? 'Yes' : 'No'}`);
        console.log(`   Submit forms: ${options.submitForms ? 'Yes' : 'No'}`);
        console.log('');
        // Execute automation
        console.log('🎯 Starting Rome Protocol automation...');
        const stats = await automation.executeFullAutomation(options);
        // Display results
        console.log('\n🎉 AUTOMATION COMPLETED!');
        console.log('========================');
        displayStats(stats);
    }
    catch (error) {
        logger_1.logger.error('Fatal error in automation', error);
        console.error('💥 Automation failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
function parseArguments(args) {
    const options = {
        walletCount: 5,
        contractsPerWallet: 1,
        startRandomActivity: true,
        submitForms: true
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        switch (arg) {
            case '--wallets':
            case '-w':
                if (nextArg && !isNaN(Number(nextArg))) {
                    options.walletCount = parseInt(nextArg);
                    i++;
                }
                break;
            case '--contracts':
            case '-c':
                if (nextArg && !isNaN(Number(nextArg))) {
                    options.contractsPerWallet = parseInt(nextArg);
                    i++;
                }
                break;
            case '--no-activity':
                options.startRandomActivity = false;
                break;
            case '--no-forms':
                options.submitForms = false;
                break;
            case '--help':
            case '-h':
                displayHelp();
                process.exit(0);
                break;
        }
    }
    return options;
}
function displayHelp() {
    console.log(`
Rome Protocol Automation Bot

Usage: npm run dev [options]

Options:
  -w, --wallets <number>       Number of wallets to create (default: 5)
  -c, --contracts <number>     Contracts per wallet to deploy (default: 1)
  --no-activity               Skip random blockchain activity
  --no-forms                   Skip Google Forms submission
  -h, --help                   Show this help message

Examples:
  npm run dev                                    # Run with default settings (random activity enabled)
  npm run dev -w 10 -c 2                       # 10 wallets, 2 contracts each, with random activity
  npm run dev --no-forms                        # Skip forms submission, keep random activity
  npm run dev -w 3 --no-activity --no-forms    # 3 wallets, no random activity, no forms

Environment Variables:
  See .env.example for configuration options

Features:
  ✨ Automatic wallet generation (Solana + EVM)
  ✨ SOL faucet integration
  ✨ Browser automation for Rome Protocol
  ✨ SOL to rSOL bridging
  ✨ Smart contract deployment
  ✨ Intelligent random blockchain activity
  ✨ Google Forms automation
  ✨ Error handling and retry logic
  ✨ Progress saving and recovery
  `);
}
function displayStats(stats) {
    const duration = stats.endTime ? (stats.endTime - stats.startTime) / 1000 : 0;
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`👛 Wallets Created: ${stats.walletsCreated}`);
    console.log(`💰 Total SOL Balance: ${stats.solanaBalance.toFixed(2)} SOL`);
    console.log(`🪙 Total rSOL Balance: ${stats.rSolBalance.toFixed(2)} rSOL`);
    console.log(`🌉 Bridges Completed: ${stats.bridgesCompleted}`);
    console.log(`📜 Contracts Deployed: ${stats.contractsDeployed}`);
    console.log(`🎲 Random Activities: ${stats.transactionsCompleted}`);
    if (stats.errors.length > 0) {
        console.log(`❌ Errors: ${stats.errors.length}`);
        console.log('\nError Details:');
        stats.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }
    else {
        console.log('✅ No errors encountered!');
    }
    console.log('\n📁 Check the following directories for detailed logs:');
    console.log('   📝 logs/ - Application logs');
    console.log('   👛 wallets/ - Encrypted wallet files');
    console.log('   📊 progress/ - Progress snapshots');
    console.log('   📸 screenshots/ - Browser screenshots');
}
// Handle process signals
process.on('SIGINT', () => {
    console.log('\n⚠️  Received SIGINT, gracefully shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n⚠️  Received SIGTERM, gracefully shutting down...');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection', { reason, promise });
    console.error('💥 Unhandled promise rejection:', reason);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', error);
    console.error('💥 Uncaught exception:', error.message);
    process.exit(1);
});
// Start the application
if (require.main === module) {
    main().catch((error) => {
        console.error('💥 Application failed to start:', error.message);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map