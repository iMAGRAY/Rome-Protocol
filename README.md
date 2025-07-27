# 🚀 Rome Protocol Automation Bot

Полнофункциональный бот для автоматизации всех этапов работы с Rome Protocol тестнетом.

## 🌟 Возможности

- ✨ **Автоматическое создание кошельков** - Генерация Solana Keypair и EVM приватных ключей
- ✨ **Шифрованное хранилище** - Безопасное сохранение всех кошельков с AES шифрованием
- ✨ **Интеграция с Solana Faucet** - Автоматический запрос SOL на Devnet
- ✨ **Браузерная автоматизация** - Подключение к Rome Protocol через Playwright
- ✨ **SOL → rSOL мост** - Автоматический бриджинг с подтверждением транзакций
- ✨ **Деплой контрактов** - Автоматический деплой HelloWorld контрактов
- ✨ **Массовые транзакции** - До 10,000+ транзакций с оптимизацией газа
- ✨ **Google Forms** - Автоматическое заполнение форм для наград
- ✨ **Обработка ошибок** - Автоматические повторы и переключение RPC
- ✨ **Сохранение прогресса** - Восстановление после сбоев

## 🛠️ Установка

### Предварительные требования

- Node.js 18+ 
- npm или yarn
- Git

### Быстрая установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd Rome-Protocol

# Установить зависимости
npm install

# Установить Playwright браузеры
npx playwright install chromium

# Настроить расширения браузера
npm run install-extensions

# Создать конфигурацию
cp .env.example .env
```

### Конфигурация

Отредактируйте `.env` файл:

```env
# ОБЯЗАТЕЛЬНО: Ключ шифрования (32+ символов)
ENCRYPTION_KEY=your-super-secure-32-character-key-here

# RPC URLs (по умолчанию настроены для тестнета)
SOLANA_RPC_URL=https://api.devnet.solana.com
ROME_RPC_URL=https://caelian.testnet.romeprotocol.xyz/
ROME_MARTIS_RPC_URL=https://martis.testnet.romeprotocol.xyz/

# Лимиты транзакций
MAX_TRANSACTIONS=10000
TX_BATCH_SIZE=50
TX_DELAY_MS=100

# Google Forms (опционально)
GOOGLE_FORM_URL=https://docs.google.com/forms/d/your-form-id/formResponse
GOOGLE_FORM_ENTRY_ADDRESS=entry.123456789
GOOGLE_FORM_ENTRY_TX_COUNT=entry.987654321

# Браузер
HEADLESS=false
BROWSER_TIMEOUT=30000
```

## 🚀 Использование

### Основные команды

```bash
# Запуск с настройками по умолчанию
npm run dev

# Настройка количества кошельков и транзакций
npm run dev -- -w 10 -t 5000

# Полная настройка
npm run dev -- --wallets 10 --contracts 2 --transactions 5000

# Без отправки форм
npm run dev -- --no-forms

# Помощь
npm run dev -- --help
```

### Параметры командной строки

| Параметр | Короткий | Описание | По умолчанию |
|----------|----------|----------|--------------|
| `--wallets` | `-w` | Количество кошельков | 5 |
| `--contracts` | `-c` | Контрактов на кошелек | 1 |
| `--transactions` | `-t` | Целевое количество транзакций | 10000 |
| `--no-forms` | | Пропустить Google Forms | false |
| `--help` | `-h` | Показать справку | |

### Примеры использования

```bash
# Быстрый тест с 3 кошельками и 1000 транзакций
npm run dev -- -w 3 -t 1000

# Масштабируемый запуск для максимальной активности
npm run dev -- -w 20 -c 3 -t 20000

# Только создание кошельков и деплой контрактов
npm run dev -- -w 5 -c 2 -t 0 --no-forms
```

## 📋 Этапы автоматизации

### 1. 👛 Создание кошельков
- Генерация HD кошельков из mnemonic фразы
- Создание Solana keypair и EVM приватного ключа
- Шифрование и сохранение в `wallets/` директории

### 2. 💰 Запрос SOL
- Автоматические запросы через Solana RPC
- Резервные faucet endpoints
- Соблюдение лимитов (2 запроса в 8 часов)

### 3. 🌐 Подключение к Rome Protocol
- Запуск браузера с расширениями кошельков
- Автоматическое подключение к deposit.testnet.romeprotocol.xyz
- Добавление сетей Caelian/Martis

### 4. 🌉 Бриджинг SOL → rSOL
- Выбор опции "Bridge $SOL" на сайте
- Подтверждение транзакций в обоих кошельках
- Проверка получения rSOL баланса

### 5. 📜 Деплой контрактов
- Компиляция HelloWorld.sol (pragma 0.8.20)
- Деплой на Rome EVM с оптимизированным газом
- Верификация через вызов функций

### 6. 💸 Массовые транзакции
- **70% случайные переводы** между кошельками
- **20% циклические переводы** по цепочке кошельков  
- **10% взаимодействия с контрактами**
- Оптимизация газа и batch обработка

### 7. 📝 Заполнение форм наград
- Автоматическое заполнение Google Forms
- Отправка адресов кошельков и количества транзакций
- Поддержка API и браузерного заполнения

## 🔧 Продвинутые возможности

### Обработка ошибок и восстановление

```bash
# Автоматические повторы операций
- Переключение между RPC endpoints
- Экспоненциальные задержки
- Сохранение прогресса каждого этапа

# Восстановление после сбоя
node dist/index.js --resume progress/progress_1234567890.json
```

### Мониторинг и логирование

```bash
# Проверка логов
tail -f logs/combined.log

# Ошибки
tail -f logs/error.log

# Структурированные данные
cat progress/progress_latest.json | jq .
```

### Безопасность

- Все приватные ключи шифруются AES-256
- Соль и IV генерируются для каждого кошелька
- Логи не содержат чувствительных данных
- Опциональное удаление кошельков после завершения

## 📊 Мониторинг прогресса

Бот создает следующие директории:

```
Rome-Protocol/
├── wallets/          # Зашифрованные кошельки
├── logs/             # Логи приложения
├── progress/         # Снапшоты прогресса
├── screenshots/      # Скриншоты браузера
├── browser-data/     # Данные браузера
└── extensions/       # Расширения кошельков
```

### Статистика в реальном времени

```
🎉 AUTOMATION COMPLETED!
========================
⏱️  Duration: 1247.32 seconds
👛 Wallets Created: 10
💰 Total SOL Balance: 18.50 SOL
🪙 Total rSOL Balance: 8.20 rSOL
🌉 Bridges Completed: 5
📜 Contracts Deployed: 15
💸 Transactions Completed: 9847
✅ No errors encountered!
```

## 🐛 Решение проблем

### Частые проблемы

**1. Ошибка подключения к Solana**
```bash
# Проверить RPC endpoint
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

**2. Браузер не запускается**
```bash
# Переустановить Playwright
npx playwright install --force chromium
```

**3. Кошельки не подключаются**
```bash
# Проверить расширения
npm run install-extensions
# Запустить в не-headless режиме
HEADLESS=false npm run dev
```

**4. Транзакции не проходят**
```bash
# Проверить балансы
# Увеличить gas price в конфигурации
# Использовать альтернативные RPC
```

### Логи отладки

```bash
# Включить debug логи
DEBUG=* npm run dev

# Проверить health check
node -e "
const { RomeAutomation } = require('./dist/services/RomeAutomation');
new RomeAutomation().healthCheck().then(console.log);
"
```

## 🔄 Оптимизация производительности

### Настройка лимитов

```env
# Увеличить batch размер для быстрых RPC
TX_BATCH_SIZE=100

# Уменьшить задержку для быстрых сетей  
TX_DELAY_MS=50

# Увеличить таймауты для медленных соединений
BROWSER_TIMEOUT=60000
```

### Масштабирование

```bash
# Запуск нескольких инстансов параллельно
npm run dev -- -w 5 -t 2000 &
npm run dev -- -w 5 -t 2000 &
npm run dev -- -w 5 -t 2000 &
wait
```

## 📋 Требования тестнета

### Rome Protocol Testnet
- Сеть: Caelian/Martis Testnet
- Chain ID: 57005 (Caelian), 57006 (Martis)
- Нативный токен: ETH
- Bridge токен: rSOL

### Минимальные требования для активности
- ✅ 10+ транзакций между собственными адресами
- ✅ 1+ деплой контракта
- ✅ 1+ взаимодействие с контрактом
- ✅ 1+ bridge операция SOL → rSOL

### Максимальная активность (этот бот)
- 🚀 10,000+ транзакций
- 🚀 5+ кошельков
- 🚀 15+ контрактов
- 🚀 Множественные bridge операции
- 🚀 Оптимизированный gas usage

## 🤝 Вклад в проект

1. Fork репозитория
2. Создать feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Открыть Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. `LICENSE` файл для деталей.

## ⚠️ Дисклеймер

Этот бот предназначен исключительно для тестирования Rome Protocol testnet. 

- Используйте только на testnet
- Не используйте mainnet приватные ключи
- Автор не несет ответственности за потерю средств
- Соблюдайте ToS Rome Protocol

## 🙏 Благодарности

- Rome Protocol team за инновационную L2 платформу
- Solana Foundation за robust devnet infrastructure  
- Playwright team за отличный браузерный движок
- Ethers.js за powerful Web3 библиотеку

---

**Made with ❤️ for Rome Protocol community**

*Запускайте, тестируйте, получайте награды! 🎉*