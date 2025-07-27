#!/usr/bin/env node

import { RomeAutomation } from './services/RomeAutomation';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';

async function main() {
  console.log('🚀 Rome Protocol Automation Bot v1.0');
  console.log('=====================================');

  try {
    // Validate configuration
    if (!validateConfig()) {
      console.error('❌ Configuration validation failed');
      process.exit(1);
    }

    console.log('✅ Configuration validated');

    // Initialize automation
    const automation = new RomeAutomation();

    // Health check
    console.log('🔍 Running health check...');
    const healthStatus = await automation.healthCheck();
    
    for (const [check, status] of Object.entries(healthStatus)) {
      if (check === 'browserInstalled') {
        console.log(`${status ? '✅' : '⚠️'} ${check}: ${status ? 'OK' : 'WILL AUTO-INSTALL'}`);
      } else {
        console.log(`${status ? '✅' : '❌'} ${check}: ${status ? 'OK' : 'FAILED'}`);
      }
    }

    // Don't fail on browser installation - it will auto-install
    const criticalChecks = Object.entries(healthStatus).filter(([check]) => check !== 'browserInstalled');
    const allCriticalHealthy = criticalChecks.every(([, status]) => status);
    
    if (!allCriticalHealthy) {
      console.warn('⚠️  Some critical health checks failed, but continuing...');
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

  } catch (error) {
    logger.error('Fatal error in automation', error);
    console.error('💥 Automation failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseArguments(args: string[]): {
  walletCount: number;
  contractsPerWallet: number;
  startRandomActivity: boolean;
  submitForms: boolean;
} {
  const options = {
    walletCount: config.wallet.defaultCount, // Теперь из .env
    contractsPerWallet: config.wallet.defaultContracts, // Теперь из .env
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

function displayHelp(): void {
  console.log(`
Rome Protocol Automation Bot

Usage: npm run dev [options]

Options:
  -w, --wallets <number>       Number of wallets to create (default: from .env DEFAULT_WALLET_COUNT=${config.wallet.defaultCount})
  -c, --contracts <number>     Contracts per wallet to deploy (default: from .env DEFAULT_CONTRACTS_PER_WALLET=${config.wallet.defaultContracts})
  --no-activity               Skip random blockchain activity
  --no-forms                   Skip Google Forms submission
  -h, --help                   Show this help message

Examples:
  npm run dev                                    # Run with .env defaults (wallets=${config.wallet.defaultCount}, contracts=${config.wallet.defaultContracts})
  npm run dev -w 10 -c 2                       # Override .env: 10 wallets, 2 contracts each
  npm run dev --no-forms                        # Use .env defaults, skip forms submission
  npm run dev -w 3 --no-activity --no-forms    # 3 wallets, no random activity, no forms

Configuration:
  Edit .env file to change default values:
  DEFAULT_WALLET_COUNT=5       # Default number of wallets
  DEFAULT_CONTRACTS_PER_WALLET=1  # Default contracts per wallet

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

function displayStats(stats: any): void {
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
    stats.errors.forEach((error: string, index: number) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  } else {
    console.log('✅ No errors encountered!');
  }

  console.log('\n📁 Check the following directories for detailed logs:');
  console.log('   📝 logs/ - Application logs');
  console.log('   👛 wallets/ - Encrypted wallet files');
  console.log('   📊 progress/ - Progress snapshots');
  console.log('   📸 screenshots/ - Browser screenshots');
  console.log(`   📊 ${config.excel.fileName} - Excel статистика (полная)`);
  console.log('');
  console.log('🔧 Настройки из .env файла:');
  console.log(`   Seed: ${config.wallet.seed.substring(0, 30)}...`);
  console.log(`   Задержка активности: ${config.activity.minDelayMs/1000}-${config.activity.maxDelayMs/1000} сек`);
  console.log(`   Сумма переводов: ${config.activity.minAmount}-${config.activity.maxAmount} ETH`);
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
  logger.error('Unhandled rejection', { reason, promise });
  console.error('💥 Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
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