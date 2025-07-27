export interface WalletPair {
  solana: {
    publicKey: string;
    privateKey: string;
    keypair: any;
  };
  evm: {
    address: string;
    privateKey: string;
  };
}

export interface EncryptedWallet {
  encrypted: string;
  salt: string;
  iv: string;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  gasUsed?: number;
  error?: string;
  timestamp: number;
}

export interface BridgeResult {
  solanaHash?: string;
  evmHash?: string;
  success: boolean;
  rSolBalance?: string;
  error?: string;
}

export interface ContractDeployResult {
  address: string;
  hash: string;
  success: boolean;
  error?: string;
}

export interface RomeConfig {
  depositUrl: string;
  chainId: number;
  rpcUrl: string;
  martisRpcUrl: string;
}

export interface AutomationStats {
  walletsCreated: number;
  solanaBalance: number;
  rSolBalance: number;
  transactionsCompleted: number;
  contractsDeployed: number;
  bridgesCompleted: number;
  errors: string[];
  startTime: number;
  endTime?: number;
}