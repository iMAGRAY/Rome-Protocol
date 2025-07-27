import axios from 'axios';
import { Page } from 'playwright';
import { config } from '../config';
import { logger } from '../utils/logger';

export class GoogleFormsService {
  private formUrl: string;
  private addressEntry: string;
  private txCountEntry: string;

  constructor() {
    this.formUrl = config.googleForms.url;
    this.addressEntry = config.googleForms.addressEntry;
    this.txCountEntry = config.googleForms.txCountEntry;
  }

  public async submitFormAPI(
    walletAddress: string,
    transactionCount: number,
    additionalData?: Record<string, string>
  ): Promise<boolean> {
    if (!this.formUrl || !this.addressEntry || !this.txCountEntry) {
      logger.warn('Google Forms configuration not complete');
      return false;
    }

    try {
      const formData = new URLSearchParams();
      formData.append(this.addressEntry, walletAddress);
      formData.append(this.txCountEntry, transactionCount.toString());

      // Add any additional data
      if (additionalData) {
        for (const [key, value] of Object.entries(additionalData)) {
          formData.append(key, value);
        }
      }

      const response = await axios.post(this.formUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      if (response.status === 200) {
        logger.info(`Form submitted successfully for ${walletAddress} with ${transactionCount} transactions`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to submit form via API', error);
      return false;
    }
  }

  public async submitFormBrowser(
    page: Page,
    walletAddress: string,
    transactionCount: number,
    additionalData?: Record<string, string>
  ): Promise<boolean> {
    if (!this.formUrl) {
      logger.warn('Google Forms URL not configured');
      return false;
    }

    try {
      // Navigate to form
      await page.goto(this.formUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // Fill wallet address field
      const addressSelectors = [
        `input[name="${this.addressEntry}"]`,
        'input[aria-label*="address"]',
        'input[aria-label*="Address"]',
        'input[aria-label*="wallet"]',
        'input[aria-label*="Wallet"]'
      ];

      for (const selector of addressSelectors) {
        try {
          const addressInput = await page.waitForSelector(selector, { timeout: 5000 });
          if (addressInput) {
            await addressInput.fill(walletAddress);
            logger.info(`Filled wallet address: ${walletAddress}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Fill transaction count field
      const txCountSelectors = [
        `input[name="${this.txCountEntry}"]`,
        'input[aria-label*="transaction"]',
        'input[aria-label*="Transaction"]',
        'input[aria-label*="count"]',
        'input[aria-label*="Count"]'
      ];

      for (const selector of txCountSelectors) {
        try {
          const txInput = await page.waitForSelector(selector, { timeout: 5000 });
          if (txInput) {
            await txInput.fill(transactionCount.toString());
            logger.info(`Filled transaction count: ${transactionCount}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Fill additional data if provided
      if (additionalData) {
        for (const [key, value] of Object.entries(additionalData)) {
          try {
            const input = await page.waitForSelector(`input[name="${key}"]`, { timeout: 3000 });
            if (input) {
              await input.fill(value);
              logger.info(`Filled ${key}: ${value}`);
            }
          } catch (e) {
            logger.warn(`Could not fill field ${key}`);
          }
        }
      }

      // Submit form
      const submitSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        '[aria-label="Submit"]'
      ];

      for (const selector of submitSelectors) {
        try {
          const submitButton = await page.waitForSelector(selector, { timeout: 5000 });
          if (submitButton) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            logger.info('Form submitted successfully');
            return true;
          }
        } catch (e) {
          continue;
        }
      }

      logger.error('Could not find submit button');
      return false;

    } catch (error) {
      logger.error('Failed to submit form via browser', error);
      return false;
    }
  }

  public async submitMultipleForms(
    walletAddresses: string[],
    transactionCounts: number[],
    method: 'api' | 'browser' = 'api',
    page?: Page
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    if (walletAddresses.length !== transactionCounts.length) {
      logger.error('Wallet addresses and transaction counts arrays must have the same length');
      return results;
    }

    for (let i = 0; i < walletAddresses.length; i++) {
      const address = walletAddresses[i];
      const txCount = transactionCounts[i];

      try {
        let success = false;

        if (method === 'api') {
          success = await this.submitFormAPI(address, txCount);
        } else if (method === 'browser' && page) {
          success = await this.submitFormBrowser(page, address, txCount);
        }

        results.set(address, success);

        // Add delay between submissions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        logger.error(`Failed to submit form for ${address}`, error);
        results.set(address, false);
      }
    }

    const successCount = Array.from(results.values()).filter(Boolean).length;
    logger.info(`Form submission completed: ${successCount}/${walletAddresses.length} successful`);

    return results;
  }

  public async extractFormStructure(page: Page): Promise<Record<string, string>> {
    if (!this.formUrl) {
      return {};
    }

    try {
      await page.goto(this.formUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const formStructure: Record<string, string> = {};

      // Extract input fields
      const inputs = await page.$$('input');
      
      for (const input of inputs) {
        try {
          const name = await input.getAttribute('name');
          const ariaLabel = await input.getAttribute('aria-label');
          const type = await input.getAttribute('type');
          const placeholder = await input.getAttribute('placeholder');

          if (name) {
            const label = ariaLabel || placeholder || `${type}_field`;
            formStructure[name] = label;
          }
        } catch (e) {
          continue;
        }
      }

      // Extract textarea fields
      const textareas = await page.$$('textarea');
      
      for (const textarea of textareas) {
        try {
          const name = await textarea.getAttribute('name');
          const ariaLabel = await textarea.getAttribute('aria-label');

          if (name) {
            const label = ariaLabel || 'textarea_field';
            formStructure[name] = label;
          }
        } catch (e) {
          continue;
        }
      }

      logger.info('Form structure extracted:', formStructure);
      return formStructure;

    } catch (error) {
      logger.error('Failed to extract form structure', error);
      return {};
    }
  }

  public async validateFormUrl(): Promise<boolean> {
    if (!this.formUrl) {
      return false;
    }

    try {
      const response = await axios.get(this.formUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      return response.status === 200;
    } catch (error) {
      logger.error('Form URL validation failed', error);
      return false;
    }
  }

  public async autoDetectFormFields(page: Page): Promise<{ addressField?: string; txCountField?: string }> {
    if (!this.formUrl) {
      return {};
    }

    try {
      await page.goto(this.formUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const result: { addressField?: string; txCountField?: string } = {};

      // Auto-detect address field
      const addressKeywords = ['address', 'wallet', 'account', 'публичный', 'адрес'];
      const inputs = await page.$$('input');

      for (const input of inputs) {
        try {
          const name = await input.getAttribute('name');
          const ariaLabel = await input.getAttribute('aria-label');
          const placeholder = await input.getAttribute('placeholder');

          const fieldText = `${name} ${ariaLabel} ${placeholder}`.toLowerCase();

          // Check for address field
          if (!result.addressField && addressKeywords.some(keyword => fieldText.includes(keyword))) {
            result.addressField = name || '';
            logger.info(`Auto-detected address field: ${name}`);
          }

          // Check for transaction count field
          const txKeywords = ['transaction', 'count', 'количество', 'транзакций'];
          if (!result.txCountField && txKeywords.some(keyword => fieldText.includes(keyword))) {
            result.txCountField = name || '';
            logger.info(`Auto-detected transaction count field: ${name}`);
          }

        } catch (e) {
          continue;
        }
      }

      return result;

    } catch (error) {
      logger.error('Failed to auto-detect form fields', error);
      return {};
    }
  }

  public async createRewardData(
    walletAddress: string,
    transactionCount: number,
    contractAddresses?: string[],
    totalVolume?: string
  ): Promise<Record<string, string>> {
    const data: Record<string, string> = {};

    // Basic required fields
    data['wallet_address'] = walletAddress;
    data['transaction_count'] = transactionCount.toString();
    data['timestamp'] = new Date().toISOString();

    // Optional fields
    if (contractAddresses && contractAddresses.length > 0) {
      data['deployed_contracts'] = contractAddresses.join(', ');
      data['contract_count'] = contractAddresses.length.toString();
    }

    if (totalVolume) {
      data['total_volume'] = totalVolume;
    }

    // Additional metadata
    data['network'] = 'Rome Protocol Testnet';
    data['automation_tool'] = 'Rome Protocol Bot v1.0';

    return data;
  }
}