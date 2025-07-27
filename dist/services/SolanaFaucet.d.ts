export declare class SolanaFaucet {
    private connection;
    private faucetUrl;
    private lastRequest;
    private readonly RATE_LIMIT_MS;
    constructor();
    requestAirdrop(publicKey: string, amount?: number): Promise<boolean>;
    getBalance(publicKey: string): Promise<number>;
    waitForBalance(publicKey: string, minBalance?: number, timeoutMs?: number): Promise<boolean>;
    requestMultipleAirdrops(publicKeys: string[], amount?: number): Promise<Map<string, boolean>>;
    canRequestAirdrop(publicKey: string): boolean;
    getTimeUntilNextRequest(publicKey: string): number;
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=SolanaFaucet.d.ts.map