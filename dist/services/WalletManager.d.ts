import { WalletPair, EncryptedWallet } from '../types';
export declare class WalletManager {
    private walletsDir;
    private encryptionKey;
    constructor();
    private ensureWalletsDirectory;
    generateWalletPair(index?: number): Promise<WalletPair>;
    encryptWallet(walletPair: WalletPair): EncryptedWallet;
    decryptWallet(encryptedWallet: EncryptedWallet): WalletPair;
    saveWallet(walletPair: WalletPair, filename?: string): string;
    loadWallet(filepath: string): WalletPair;
    listWallets(): string[];
    checkBalances(walletPair: WalletPair): Promise<{
        solBalance: number;
        evmBalance: string;
    }>;
    generateMultipleWallets(count: number): Promise<WalletPair[]>;
}
//# sourceMappingURL=WalletManager.d.ts.map