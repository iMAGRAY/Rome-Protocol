import { WalletPair, BridgeResult } from '../types';
export declare class BrowserAutomation {
    private browser;
    private context;
    private page;
    private extensionsPath;
    constructor();
    private ensureExtensionsDirectory;
    initializeBrowser(): Promise<void>;
    navigateToRome(): Promise<void>;
    connectWallets(walletPair: WalletPair): Promise<boolean>;
    private addRomeNetwork;
    performBridge(amount?: number): Promise<BridgeResult>;
    checkRSolBalance(): Promise<string>;
    takeScreenshot(filename?: string): Promise<void>;
    close(): Promise<void>;
    handleWalletPopup(): Promise<void>;
}
//# sourceMappingURL=BrowserAutomation.d.ts.map