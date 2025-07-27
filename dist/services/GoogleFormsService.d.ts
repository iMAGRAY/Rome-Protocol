import { Page } from 'playwright';
export declare class GoogleFormsService {
    private formUrl;
    private addressEntry;
    private txCountEntry;
    constructor();
    submitFormAPI(walletAddress: string, transactionCount: number, additionalData?: Record<string, string>): Promise<boolean>;
    submitFormBrowser(page: Page, walletAddress: string, transactionCount: number, additionalData?: Record<string, string>): Promise<boolean>;
    submitMultipleForms(walletAddresses: string[], transactionCounts: number[], method?: 'api' | 'browser', page?: Page): Promise<Map<string, boolean>>;
    extractFormStructure(page: Page): Promise<Record<string, string>>;
    validateFormUrl(): Promise<boolean>;
    autoDetectFormFields(page: Page): Promise<{
        addressField?: string;
        txCountField?: string;
    }>;
    createRewardData(walletAddress: string, transactionCount: number, contractAddresses?: string[], totalVolume?: string): Promise<Record<string, string>>;
}
//# sourceMappingURL=GoogleFormsService.d.ts.map