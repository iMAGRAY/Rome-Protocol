"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAutomation = void 0;
const playwright_1 = require("playwright");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class BrowserAutomation {
    browser = null;
    context = null;
    page = null;
    extensionsPath;
    constructor() {
        this.extensionsPath = path_1.default.join(process.cwd(), 'extensions');
        this.ensureExtensionsDirectory();
    }
    ensureExtensionsDirectory() {
        if (!fs_1.default.existsSync(this.extensionsPath)) {
            fs_1.default.mkdirSync(this.extensionsPath, { recursive: true });
            logger_1.logger.info('Created extensions directory');
        }
    }
    async initializeBrowser() {
        try {
            // Launch browser with extensions
            this.context = await playwright_1.chromium.launchPersistentContext(path_1.default.join(process.cwd(), 'browser-data'), {
                headless: config_1.config.browser.headless,
                args: [
                    '--disable-web-security',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    `--disable-extensions-except=${this.extensionsPath}`,
                    `--load-extension=${this.extensionsPath}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                ],
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });
            this.browser = this.context.browser();
            this.page = await this.context.newPage();
            // Set longer timeouts
            this.page.setDefaultTimeout(config_1.config.browser.timeout);
            this.page.setDefaultNavigationTimeout(config_1.config.browser.timeout);
            logger_1.logger.info('Browser initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize browser', error);
            throw error;
        }
    }
    async navigateToRome() {
        if (!this.page)
            throw new Error('Browser not initialized');
        try {
            await this.page.goto(config_1.config.rome.depositUrl, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);
            logger_1.logger.info('Navigated to Rome Protocol deposit page');
        }
        catch (error) {
            logger_1.logger.error('Failed to navigate to Rome Protocol', error);
            throw error;
        }
    }
    async connectWallets(walletPair) {
        if (!this.page)
            throw new Error('Browser not initialized');
        try {
            // Look for connect wallet button
            const connectSelectors = [
                'button:has-text("Connect Wallet")',
                'button:has-text("Connect")',
                '[data-testid="connect-wallet"]',
                '.connect-wallet-button',
                'button[class*="connect"]'
            ];
            let connectButton = null;
            for (const selector of connectSelectors) {
                try {
                    connectButton = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (connectButton)
                        break;
                }
                catch (e) {
                    continue;
                }
            }
            if (!connectButton) {
                logger_1.logger.error('Connect wallet button not found');
                return false;
            }
            await connectButton.click();
            await this.page.waitForTimeout(2000);
            // Try to connect MetaMask/Rabby
            const walletSelectors = [
                'button:has-text("MetaMask")',
                'button:has-text("Rabby")',
                '[data-testid="metamask"]',
                '[data-testid="rabby"]'
            ];
            for (const selector of walletSelectors) {
                try {
                    const walletButton = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (walletButton) {
                        await walletButton.click();
                        await this.page.waitForTimeout(2000);
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            // Handle wallet popup - this is a simplified approach
            // In production, you'd need to handle the actual extension popups
            await this.page.waitForTimeout(5000);
            // Check if wallet is connected
            const walletConnectedSelectors = [
                '[data-testid="wallet-connected"]',
                'button:has-text("Disconnect")',
                '.wallet-address',
                '[class*="connected"]'
            ];
            for (const selector of walletConnectedSelectors) {
                try {
                    const connected = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (connected) {
                        logger_1.logger.info('Wallet connected successfully');
                        return true;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            // Try to add Rome network if not connected
            await this.addRomeNetwork();
            logger_1.logger.info('Wallet connection process completed');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to connect wallets', error);
            return false;
        }
    }
    async addRomeNetwork() {
        if (!this.page)
            return;
        try {
            // Look for network selector or add network button
            const networkSelectors = [
                'button:has-text("Add Network")',
                'button:has-text("Switch Network")',
                '[data-testid="network-selector"]'
            ];
            for (const selector of networkSelectors) {
                try {
                    const networkButton = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (networkButton) {
                        await networkButton.click();
                        await this.page.waitForTimeout(1000);
                        // Try to find Rome testnet options
                        const romeSelectors = [
                            'button:has-text("Caelian")',
                            'button:has-text("Martis")',
                            'button:has-text("Rome")'
                        ];
                        for (const romeSelector of romeSelectors) {
                            try {
                                const romeButton = await this.page.waitForSelector(romeSelector, { timeout: 2000 });
                                if (romeButton) {
                                    await romeButton.click();
                                    await this.page.waitForTimeout(2000);
                                    logger_1.logger.info('Rome network added/switched');
                                    return;
                                }
                            }
                            catch (e) {
                                continue;
                            }
                        }
                    }
                }
                catch (e) {
                    continue;
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not add Rome network automatically', error);
        }
    }
    async performBridge(amount = 1) {
        if (!this.page)
            throw new Error('Browser not initialized');
        try {
            const result = { success: false };
            // Look for bridge SOL button/section
            const bridgeSelectors = [
                'button:has-text("Bridge $SOL")',
                'button:has-text("Bridge SOL")',
                '[data-testid="bridge-sol"]',
                '.bridge-button'
            ];
            let bridgeButton = null;
            for (const selector of bridgeSelectors) {
                try {
                    bridgeButton = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (bridgeButton)
                        break;
                }
                catch (e) {
                    continue;
                }
            }
            if (!bridgeButton) {
                logger_1.logger.error('Bridge SOL button not found');
                return result;
            }
            await bridgeButton.click();
            await this.page.waitForTimeout(2000);
            // Input amount if there's an input field
            const amountInputSelectors = [
                'input[placeholder*="amount"]',
                'input[placeholder*="SOL"]',
                'input[type="number"]',
                '[data-testid="amount-input"]'
            ];
            for (const selector of amountInputSelectors) {
                try {
                    const amountInput = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (amountInput) {
                        await amountInput.fill(amount.toString());
                        await this.page.waitForTimeout(1000);
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            // Confirm bridge transaction
            const confirmSelectors = [
                'button:has-text("Confirm")',
                'button:has-text("Bridge")',
                'button:has-text("Continue")',
                '[data-testid="confirm-bridge"]'
            ];
            for (const selector of confirmSelectors) {
                try {
                    const confirmButton = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (confirmButton) {
                        await confirmButton.click();
                        await this.page.waitForTimeout(3000);
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            // Wait for transaction completion
            await this.page.waitForTimeout(10000);
            // Check for success indicators
            const successSelectors = [
                ':has-text("Success")',
                ':has-text("Completed")',
                ':has-text("Bridge successful")',
                '[data-testid="success"]'
            ];
            for (const selector of successSelectors) {
                try {
                    const success = await this.page.waitForSelector(selector, { timeout: 15000 });
                    if (success) {
                        result.success = true;
                        logger_1.logger.info('Bridge operation completed successfully');
                        break;
                    }
                }
                catch (e) {
                    continue;
                }
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Bridge operation failed', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async checkRSolBalance() {
        if (!this.page)
            throw new Error('Browser not initialized');
        try {
            const balanceSelectors = [
                '[data-testid="rsol-balance"]',
                '.rsol-balance',
                ':has-text("rSOL")',
                '[class*="balance"]'
            ];
            for (const selector of balanceSelectors) {
                try {
                    const balanceElement = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (balanceElement) {
                        const balanceText = await balanceElement.textContent();
                        const match = balanceText?.match(/(\d+\.?\d*)/);
                        if (match) {
                            logger_1.logger.info(`Found rSOL balance: ${match[1]}`);
                            return match[1];
                        }
                    }
                }
                catch (e) {
                    continue;
                }
            }
            return '0';
        }
        catch (error) {
            logger_1.logger.error('Failed to check rSOL balance', error);
            return '0';
        }
    }
    async takeScreenshot(filename) {
        if (!this.page)
            return;
        try {
            const screenshotDir = path_1.default.join(process.cwd(), 'screenshots');
            if (!fs_1.default.existsSync(screenshotDir)) {
                fs_1.default.mkdirSync(screenshotDir, { recursive: true });
            }
            const screenshotPath = path_1.default.join(screenshotDir, filename || `screenshot_${Date.now()}.png`);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            logger_1.logger.info(`Screenshot saved: ${screenshotPath}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to take screenshot', error);
        }
    }
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.context = null;
                this.page = null;
                logger_1.logger.info('Browser closed');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to close browser', error);
        }
    }
    async handleWalletPopup() {
        if (!this.browser)
            return;
        try {
            // Wait for and handle wallet extension popups
            const pages = this.browser.contexts()[0].pages();
            for (const page of pages) {
                const url = page.url();
                // Check if it's a wallet extension popup
                if (url.includes('chrome-extension') || url.includes('moz-extension')) {
                    await page.waitForTimeout(2000);
                    // Look for approve/confirm buttons
                    const approveSelectors = [
                        'button:has-text("Approve")',
                        'button:has-text("Confirm")',
                        'button:has-text("Sign")',
                        'button:has-text("Connect")',
                        '[data-testid="confirm"]'
                    ];
                    for (const selector of approveSelectors) {
                        try {
                            const button = await page.waitForSelector(selector, { timeout: 3000 });
                            if (button) {
                                await button.click();
                                await page.waitForTimeout(1000);
                                logger_1.logger.info('Approved wallet transaction');
                                break;
                            }
                        }
                        catch (e) {
                            continue;
                        }
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to handle wallet popup', error);
        }
    }
}
exports.BrowserAutomation = BrowserAutomation;
//# sourceMappingURL=BrowserAutomation.js.map