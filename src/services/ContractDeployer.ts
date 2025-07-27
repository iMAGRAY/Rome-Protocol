import { ethers } from 'ethers';
import { WalletPair, ContractDeployResult } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class ContractDeployer {
  private provider: ethers.JsonRpcProvider;
  private rpcUrls: string[];
  private currentRpcIndex: number = 0;

  constructor() {
    this.rpcUrls = [
      config.rome.rpcUrl,
      config.rome.martisRpcUrl,
      'https://caelian.testnet.romeprotocol.xyz/',
      'https://martis.testnet.romeprotocol.xyz/'
    ];
    this.provider = new ethers.JsonRpcProvider(this.rpcUrls[0]);
  }

  private async switchRpc(): Promise<void> {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrls[this.currentRpcIndex]);
    logger.info(`Switched to RPC: ${this.rpcUrls[this.currentRpcIndex]}`);
  }

  public async validateConnection(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      logger.info(`Connected to network: ${network.name} (${network.chainId})`);
      return true;
    } catch (error) {
      logger.error('Failed to connect to Rome network', error);
      return false;
    }
  }

  private getHelloWorldContract(): { abi: any[], bytecode: string } {
    // HelloWorld.sol contract with pragma 0.8.20
    const abi = [
      {
        "inputs": [],
        "name": "greet",
        "outputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_greeting",
            "type": "string"
          }
        ],
        "name": "setGreeting",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
      }
    ];

    // Compiled bytecode for HelloWorld contract
    const bytecode = "0x608060405234801561001057600080fd5b506040518060400160405280600d81526020017f48656c6c6f2c20576f726c642100000000000000000000000000000000000000815250600090816100559190610293565b50610360565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806100dd57607f821691505b6020821081036100f0576100ef610096565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026101587fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261011b565b610162868361011b565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b60006101a96101a461019f8461017a565b610184565b61017a565b9050919050565b6000819050919050565b6101c38361018e565b6101d76101cf826101b0565b848454610128565b825550505050565b600090565b6101ec6101df565b6101f78184846101ba565b505050565b5b8181101561021b576102106000826101e4565b6001810190506101fd565b5050565b601f821115610260576102318161010a565b61023a8461010f565b81016020851015610249578190505b61025d6102558561010f565b8301826101fc565b50505b505050565b600082821c905092915050565b600061028360001984600802610265565b1980831691505092915050565b600061029c8383610272565b9150826002028217905092915050565b6102b58261005c565b67ffffffffffffffff8111156102ce576102cd610067565b5b6102d882546100c5565b6102e382828561021f565b600060209050601f8311600181146103165760008415610304578287015190505b61030e8582610290565b865550610376565b601f1984166103248661010a565b60005b8281101561034c57848901518255600182019150602085019450602081019050610327565b868310156103695784890151610365601f891682610272565b8355505b6001600288020188555050505b505050505050565b6103b4806103a16000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610057575b600080fd5b610055600480360381019061005091906101bc565b610075565b005b61005f610088565b60405161006c919061026e565b60405180910390f35b80600090816100849190610442565b5050565b60606000805461009790610290565b80601f01602080910402602001604051908101604052809291908181526020018280546100c390610290565b80156101105780601f106100e557610100808354040283529160200191610110565b820191906000526020600020905b8154815290600101906020018083116100f357829003601f168201915b5050505050905090565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101798261013e565b810181811067ffffffffffffffff8211171561019857610197610147565b5b80604052505050565b60006101ab61011a565b90506101b78282610170565b919050565b6000602082840312156101d2576101d1610124565b5b600082013567ffffffffffffffff8111156101f0576101ef610129565b5b6101fc8482850161012e565b91505092915050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561023f578082015181840152602081019050610224565b60008484015250505050565b600061025682610205565b6102608185610210565b9350610270818560208601610221565b6102798161013e565b840191505092915050565b6000602082019050818103600083015261029e818461024b565b905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806102ee57607f821691505b602082108103610301576103006102a6565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026103697fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261032c565b610373868361032c565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b60006103ba6103b56103b08461038b565b610395565b61038b565b9050919050565b6000819050919050565b6103d48361039f565b6103e86103e0826103c1565b848454610339565b825550505050565b600090565b6103fd6103f0565b6104088184846103cb565b505050565b5b8181101561042c576104216000826103f5565b60018101905061040e565b5050565b601f8211156104715761044281610307565b61044b8461031c565b8101602085101561045a578190505b61046e6104668561031c565b83018261040d565b50505b505050565b600082821c905092915050565b600061049460001984600802610476565b1980831691505092915050565b60006104ad8383610483565b9150826002028217905092915050565b6104c682610205565b67ffffffffffffffff8111156104df576104de610147565b5b6104e98254610290565b6104f4828285610430565b600060209050601f831160018114610527576000841561051557845194505b61051f86826104a1565b865550610587565b601f19841661053586610307565b60005b8281101561055d57848901518255600182019150602085019450602081019050610538565b8683101561057a5784890151610576601f891682610483565b8355505b6001600288020188555050505b50505050505056fea2646970667358221220a6b4e33ac3a7f9c3b8e5c1b0e8b5c1b0e8b5c1b0e8b5c1b0e8b5c1b0e8b5c1b064736f6c63430008140033";

    return { abi, bytecode };
  }

  public async deployHelloWorld(walletPair: WalletPair): Promise<ContractDeployResult> {
    let attempts = 0;
    const maxAttempts = this.rpcUrls.length;

    while (attempts < maxAttempts) {
      try {
        const wallet = new ethers.Wallet(walletPair.evm.privateKey, this.provider);
        
        // Check balance first
        const balance = await wallet.provider!.getBalance(wallet.address);
        if (balance === 0n) {
          throw new Error('Insufficient balance for deployment');
        }

        logger.info(`Deploying HelloWorld contract from ${wallet.address} with balance ${ethers.formatEther(balance)} ETH`);

        const { abi, bytecode } = this.getHelloWorldContract();
        
        // Create contract factory
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);

        // Estimate gas
        const estimatedGas = await factory.getDeployTransaction().then(tx => 
          wallet.provider!.estimateGas(tx)
        );

        // Get gas price
        const feeData = await wallet.provider!.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

        logger.info(`Estimated gas: ${estimatedGas}, Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

        // Deploy contract
        const contract = await factory.deploy({
          gasLimit: estimatedGas + 50000n, // Add some buffer
          gasPrice: gasPrice
        });

        // Wait for deployment
        const receipt = await contract.waitForDeployment();
        const address = await contract.getAddress();

        logger.info(`HelloWorld contract deployed at: ${address}`);
        logger.info(`Transaction hash: ${contract.deploymentTransaction()?.hash}`);

        // Verify deployment by calling greet function
        try {
          const greeting = await (contract as any).greet();
          logger.info(`Contract greeting: ${greeting}`);
        } catch (e) {
          logger.warn('Could not verify contract deployment by calling greet()');
        }

        return {
          address: address,
          hash: contract.deploymentTransaction()?.hash || '',
          success: true
        };

      } catch (error) {
        logger.error(`Deployment attempt ${attempts + 1} failed`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          await this.switchRpc();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    return {
      address: '',
      hash: '',
      success: false,
      error: `Failed to deploy after ${maxAttempts} attempts`
    };
  }

  public async interactWithContract(contractAddress: string, walletPair: WalletPair, newGreeting?: string): Promise<boolean> {
    try {
      const wallet = new ethers.Wallet(walletPair.evm.privateKey, this.provider);
      const { abi } = this.getHelloWorldContract();
      
      const contract = new ethers.Contract(contractAddress, abi, wallet);

      if (newGreeting) {
        // Call setGreeting
        const tx = await contract.setGreeting(newGreeting, {
          gasLimit: 100000,
          gasPrice: ethers.parseUnits('20', 'gwei')
        });
        
        const receipt = await tx.wait();
        logger.info(`Updated greeting. Transaction: ${receipt.hash}`);
      }

      // Call greet to read current greeting
      const greeting = await contract.greet();
      logger.info(`Current greeting: ${greeting}`);

      return true;
    } catch (error) {
      logger.error('Failed to interact with contract', error);
      return false;
    }
  }

  public async deployMultipleContracts(walletPairs: WalletPair[], count: number = 1): Promise<Map<string, ContractDeployResult[]>> {
    const results = new Map<string, ContractDeployResult[]>();

    for (const walletPair of walletPairs) {
      const walletResults: ContractDeployResult[] = [];
      
      for (let i = 0; i < count; i++) {
        try {
          logger.info(`Deploying contract ${i + 1}/${count} for wallet ${walletPair.evm.address}`);
          
          const result = await this.deployHelloWorld(walletPair);
          walletResults.push(result);
          
          // Add delay between deployments
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          logger.error(`Failed to deploy contract ${i + 1} for wallet ${walletPair.evm.address}`, error);
                      walletResults.push({
              address: '',
              hash: '',
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
        }
      }
      
      results.set(walletPair.evm.address, walletResults);
    }

    return results;
  }

  public async getContractCode(address: string): Promise<string> {
    try {
      return await this.provider.getCode(address);
    } catch (error) {
      logger.error(`Failed to get contract code for ${address}`, error);
      return '0x';
    }
  }

  public async verifyContract(address: string): Promise<boolean> {
    try {
      const code = await this.getContractCode(address);
      return code !== '0x';
    } catch (error) {
      logger.error(`Failed to verify contract ${address}`, error);
      return false;
    }
  }

  public async estimateDeploymentCost(): Promise<{ gasEstimate: bigint; costInEth: string }> {
    try {
      const { abi, bytecode } = this.getHelloWorldContract();
      
      // Create a temporary wallet for estimation
      const tempWallet = ethers.Wallet.createRandom().connect(this.provider);
      const factory = new ethers.ContractFactory(abi, bytecode, tempWallet);
      
      const deployTransaction = await factory.getDeployTransaction();
      const gasEstimate = await this.provider.estimateGas(deployTransaction);
      
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      
      const cost = gasEstimate * gasPrice;
      const costInEth = ethers.formatEther(cost);
      
      logger.info(`Deployment cost estimate: ${gasEstimate} gas, ${costInEth} ETH`);
      
      return { gasEstimate, costInEth };
    } catch (error) {
      logger.error('Failed to estimate deployment cost', error);
      return { gasEstimate: 0n, costInEth: '0' };
    }
  }
}