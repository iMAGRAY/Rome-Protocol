import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { AutomationStats, WalletPair, TransactionResult, ContractDeployResult } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ExcelWalletData {
  номер: number;
  solana_адрес: string;
  evm_адрес: string;
  solana_баланс: number;
  evm_баланс: string;
  количество_взаимодействий: number;
  время_создания: string;
}

export interface ExcelTransactionData {
  номер: number;
  хэш: string;
  от_кошелька: string;
  к_кошельку: string;
  сумма_eth: string;
  газ_использован: number;
  успешная: boolean;
  время: string;
  тип_активности: string;
}

export interface ExcelContractData {
  номер: number;
  адрес_контракта: string;
  владелец: string;
  хэш_деплоя: string;
  газ_деплоя: number;
  успешный_деплой: boolean;
  время_деплоя: string;
  количество_взаимодействий: number;
}

export interface ExcelSummaryData {
  параметр: string;
  значение: string | number;
  описание: string;
}

export class ExcelStats {
  private excelPath: string;
  private walletData: ExcelWalletData[] = [];
  private transactionData: ExcelTransactionData[] = [];
  private contractData: ExcelContractData[] = [];
  private summaryData: ExcelSummaryData[] = [];
  private transactionCounter: number = 0;
  private contractCounter: number = 0;

  constructor() {
    this.excelPath = path.join(process.cwd(), config.excel.fileName);
  }

  public initializeSummary(stats: AutomationStats): void {
    const startTime = new Date(stats.startTime);
    const endTime = stats.endTime ? new Date(stats.endTime) : new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    this.summaryData = [
      { параметр: 'Время старта', значение: startTime.toLocaleString('ru-RU'), описание: 'Время начала автоматизации' },
      { параметр: 'Время завершения', значение: endTime.toLocaleString('ru-RU'), описание: 'Время окончания автоматизации' },
      { параметр: 'Продолжительность (сек)', значение: duration, описание: 'Общее время работы в секундах' },
      { параметр: 'Кошельков создано', значение: stats.walletsCreated, описание: 'Количество созданных кошельков' },
      { параметр: 'Общий баланс SOL', значение: stats.solanaBalance.toFixed(4), описание: 'Сумма всех SOL балансов' },
      { параметр: 'Общий баланс rSOL', значение: stats.rSolBalance.toFixed(4), описание: 'Сумма всех rSOL балансов' },
      { параметр: 'Бриджей завершено', значение: stats.bridgesCompleted, описание: 'Количество SOL → rSOL операций' },
      { параметр: 'Контрактов задеплоено', значение: stats.contractsDeployed, описание: 'Количество задеплоенных контрактов' },
      { параметр: 'Всего активностей', значение: stats.transactionsCompleted, описание: 'Общее количество выполненных активностей' },
      { параметр: 'Ошибок', значение: stats.errors.length, описание: 'Количество ошибок' },
      { параметр: 'Seed фраза', значение: config.wallet.seed, описание: 'Используемая seed фраза для генерации кошельков' },
      { параметр: 'RPC Solana', значение: config.solana.rpcUrl, описание: 'Используемый RPC для Solana' },
      { параметр: 'RPC Rome', значение: config.rome.rpcUrl, описание: 'Используемый RPC для Rome Protocol' },
      { параметр: 'Headless режим', значение: config.browser.headless ? 'Да' : 'Нет', описание: 'Режим работы браузера' },
      { параметр: 'Мин. задержка активности (сек)', значение: config.activity.minDelayMs / 1000, описание: 'Минимальная задержка между активностями' },
      { параметр: 'Макс. задержка активности (сек)', значение: config.activity.maxDelayMs / 1000, описание: 'Максимальная задержка между активностями' }
    ];

    if (stats.errors.length > 0) {
      stats.errors.forEach((error, index) => {
        this.summaryData.push({
          параметр: `Ошибка ${index + 1}`,
          значение: error,
          описание: 'Описание ошибки'
        });
      });
    }
  }

  public addWallet(wallet: WalletPair, index: number): void {
    this.walletData.push({
      номер: index + 1,
      solana_адрес: wallet.solana.publicKey,
      evm_адрес: wallet.evm.address,
      solana_баланс: 0,
      evm_баланс: '0',
      количество_взаимодействий: 0,
      время_создания: new Date().toLocaleString('ru-RU')
    });
  }

  public updateWalletBalance(address: string, solBalance: number, evmBalance: string): void {
    const wallet = this.walletData.find(w => w.evm_адрес === address || w.solana_адрес === address);
    if (wallet) {
      wallet.solana_баланс = solBalance;
      wallet.evm_баланс = evmBalance;
    }
  }

  public addTransaction(result: TransactionResult, fromAddress: string, toAddress: string, amount: string, activityType: string): void {
    this.transactionCounter++;
    this.transactionData.push({
      номер: this.transactionCounter,
      хэш: result.hash,
      от_кошелька: fromAddress,
      к_кошельку: toAddress,
      сумма_eth: amount,
      газ_использован: result.gasUsed || 0,
      успешная: result.success,
      время: new Date(result.timestamp).toLocaleString('ru-RU'),
      тип_активности: activityType
    });

    // Update interaction count for wallet
    const wallet = this.walletData.find(w => w.evm_адрес === fromAddress);
    if (wallet) {
      wallet.количество_взаимодействий++;
    }
  }

  public addContract(result: ContractDeployResult, ownerAddress: string): void {
    this.contractCounter++;
    this.contractData.push({
      номер: this.contractCounter,
      адрес_контракта: result.address,
      владелец: ownerAddress,
      хэш_деплоя: result.hash,
      газ_деплоя: 0, // Will be updated if available
      успешный_деплой: result.success,
      время_деплоя: new Date().toLocaleString('ru-RU'),
      количество_взаимодействий: 0
    });
  }

  public addContractInteraction(contractAddress: string): void {
    const contract = this.contractData.find(c => c.адрес_контракта === contractAddress);
    if (contract) {
      contract.количество_взаимодействий++;
    }
  }

  public async saveToExcel(): Promise<void> {
    if (!config.excel.saveStats) {
      logger.info('Excel статистика отключена в конфигурации');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Создание листа "Общая статистика"
      const summarySheet = XLSX.utils.json_to_sheet(this.summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Общая статистика');

      // Создание листа "Кошельки"
      const walletsSheet = XLSX.utils.json_to_sheet(this.walletData);
      XLSX.utils.book_append_sheet(workbook, walletsSheet, 'Кошельки');

      // Создание листа "Транзакции"
      if (this.transactionData.length > 0) {
        const transactionsSheet = XLSX.utils.json_to_sheet(this.transactionData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Транзакции');
      }

      // Создание листа "Контракты"
      if (this.contractData.length > 0) {
        const contractsSheet = XLSX.utils.json_to_sheet(this.contractData);
        XLSX.utils.book_append_sheet(workbook, contractsSheet, 'Контракты');
      }

      // Создание листа "Детальная активность"
      const activitySummary = this.generateActivitySummary();
      const activitySheet = XLSX.utils.json_to_sheet(activitySummary);
      XLSX.utils.book_append_sheet(workbook, activitySheet, 'Детальная активность');

      // Сохранение файла
      XLSX.writeFile(workbook, this.excelPath);

      logger.info(`📊 Excel статистика сохранена: ${this.excelPath}`);
      logger.info(`📁 Создано листов: ${workbook.SheetNames.length}`);
      logger.info(`👛 Кошельков: ${this.walletData.length}`);
      logger.info(`💸 Транзакций: ${this.transactionData.length}`);
      logger.info(`📜 Контрактов: ${this.contractData.length}`);

    } catch (error) {
      logger.error('Ошибка сохранения Excel файла:', error);
    }
  }

  private generateActivitySummary(): any[] {
    const summary = [];

    // Группировка транзакций по типам
    const transactionsByType = this.transactionData.reduce((acc, tx) => {
      acc[tx.тип_активности] = (acc[tx.тип_активности] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    summary.push({ тип: 'ТРАНЗАКЦИИ ПО ТИПАМ', количество: '', процент: '', описание: '' });
    Object.entries(transactionsByType).forEach(([type, count]) => {
      const percent = ((count / this.transactionData.length) * 100).toFixed(1);
      summary.push({
        тип: type,
        количество: count,
        процент: `${percent}%`,
        описание: this.getActivityDescription(type)
      });
    });

    summary.push({ тип: '', количество: '', процент: '', описание: '' });

    // Статистика по кошелькам
    summary.push({ тип: 'СТАТИСТИКА ПО КОШЕЛЬКАМ', количество: '', процент: '', описание: '' });
    this.walletData.forEach(wallet => {
      summary.push({
        тип: `Кошелек ${wallet.номер}`,
        количество: wallet.количество_взаимодействий,
        процент: wallet.evm_баланс + ' ETH',
        описание: wallet.evm_адрес
      });
    });

    summary.push({ тип: '', количество: '', процент: '', описание: '' });

    // Статистика по контрактам
    if (this.contractData.length > 0) {
      summary.push({ тип: 'СТАТИСТИКА ПО КОНТРАКТАМ', количество: '', процент: '', описание: '' });
      this.contractData.forEach(contract => {
        summary.push({
          тип: `Контракт ${contract.номер}`,
          количество: contract.количество_взаимодействий,
          процент: contract.успешный_деплой ? 'Активен' : 'Ошибка',
          описание: contract.адрес_контракта
        });
      });
    }

    return summary;
  }

  private getActivityDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'Случайный перевод': 'Перевод ETH между кошельками',
      'Взаимодействие с контрактом': 'Вызов функций смарт-контракта',
      'Деплой контракта': 'Развертывание нового контракта',
      'Мульти-перевод': 'Множественные переводы одновременно',
      'Вызов контракта': 'Чтение данных из контракта',
      'Проверка баланса': 'Проверка балансов кошельков'
    };
    return descriptions[type] || 'Неизвестный тип активности';
  }

  public async loadExistingData(): Promise<void> {
    if (!fs.existsSync(this.excelPath)) {
      return;
    }

    try {
      const workbook = XLSX.readFile(this.excelPath);
      
      // Загрузка данных кошельков
      if (workbook.SheetNames.includes('Кошельки')) {
        const walletsSheet = workbook.Sheets['Кошельки'];
        const existingWallets = XLSX.utils.sheet_to_json(walletsSheet) as ExcelWalletData[];
        this.walletData = [...existingWallets];
      }

      // Загрузка данных транзакций
      if (workbook.SheetNames.includes('Транзакции')) {
        const transactionsSheet = workbook.Sheets['Транзакции'];
        const existingTransactions = XLSX.utils.sheet_to_json(transactionsSheet) as ExcelTransactionData[];
        this.transactionData = [...existingTransactions];
        this.transactionCounter = Math.max(...existingTransactions.map(t => t.номер), 0);
      }

      // Загрузка данных контрактов
      if (workbook.SheetNames.includes('Контракты')) {
        const contractsSheet = workbook.Sheets['Контракты'];
        const existingContracts = XLSX.utils.sheet_to_json(contractsSheet) as ExcelContractData[];
        this.contractData = [...existingContracts];
        this.contractCounter = Math.max(...existingContracts.map(c => c.номер), 0);
      }

      logger.info(`📊 Загружены существующие данные из Excel: кошельков ${this.walletData.length}, транзакций ${this.transactionData.length}, контрактов ${this.contractData.length}`);

    } catch (error) {
      logger.warn('Не удалось загрузить существующие данные Excel:', error);
    }
  }

  public getStats(): {
    wallets: number;
    transactions: number;
    contracts: number;
    filePath: string;
  } {
    return {
      wallets: this.walletData.length,
      transactions: this.transactionData.length,
      contracts: this.contractData.length,
      filePath: this.excelPath
    };
  }
}