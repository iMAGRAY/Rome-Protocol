const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extensionsDir = path.join(process.cwd(), 'extensions');

// Extension download URLs (these would need to be updated with actual download links)
const extensions = {
  metamask: {
    name: 'MetaMask',
    id: 'nkbihfbeogaeaoehlefnkodbefgpgknn',
    url: 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=91.0.4472.124&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc',
    filename: 'metamask.crx'
  },
  rabby: {
    name: 'Rabby Wallet',
    id: 'acmacodkjbdgmoleebolmdjonilkdbch',
    url: 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=91.0.4472.124&acceptformat=crx2,crx3&x=id%3Dacmacodkjbdgmoleebolmdjonilkdbch%26uc',
    filename: 'rabby.crx'
  }
};

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', reject);
  });
}

async function extractCrx(crxPath, extractPath) {
  try {
    // Create extraction directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Simple CRX extraction (this is a simplified version)
    // In production, you'd want to properly parse the CRX format
    const crxData = fs.readFileSync(crxPath);
    
    // Skip CRX header (first 16 bytes typically)
    const zipData = crxData.slice(16);
    
    // Write as ZIP file and extract
    const tempZip = path.join(extractPath, 'temp.zip');
    fs.writeFileSync(tempZip, zipData);
    
    try {
      execSync(`cd "${extractPath}" && unzip -o temp.zip`, { stdio: 'ignore' });
      fs.unlinkSync(tempZip);
      console.log(`✅ Extracted ${path.basename(crxPath)} to ${extractPath}`);
    } catch (e) {
      console.warn(`⚠️  Could not extract ${crxPath} - you may need to install manually`);
    }
  } catch (error) {
    console.error(`❌ Failed to extract ${crxPath}:`, error.message);
  }
}

async function installExtensions() {
  console.log('🔧 Installing browser extensions for Rome Protocol automation...');
  
  // Create extensions directory
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }

  // Create basic extension structure for development
  createBasicExtensions();

  console.log('📦 Browser extensions setup completed!');
  console.log('');
  console.log('📋 MANUAL SETUP REQUIRED:');
  console.log('1. Install MetaMask extension in your browser');
  console.log('2. Install Rabby wallet extension in your browser'); 
  console.log('3. Setup test networks in both wallets:');
  console.log('   - Caelian Testnet: https://caelian.testnet.romeprotocol.xyz/');
  console.log('   - Martis Testnet: https://martis.testnet.romeprotocol.xyz/');
  console.log('4. Import your wallet private keys from the generated wallets');
  console.log('');
  console.log('⚠️  NOTE: Browser automation with wallet extensions requires:');
  console.log('   - Running in non-headless mode (HEADLESS=false)');
  console.log('   - Manual approval of transactions during automation');
  console.log('   - Proper extension setup and configuration');
}

function createBasicExtensions() {
  // Create basic extension manifests for development
  const metamaskDir = path.join(extensionsDir, 'metamask');
  const rabbyDir = path.join(extensionsDir, 'rabby');

  // MetaMask placeholder
  if (!fs.existsSync(metamaskDir)) {
    fs.mkdirSync(metamaskDir, { recursive: true });
    
    const metamaskManifest = {
      manifest_version: 3,
      name: "MetaMask Development",
      version: "1.0.0",
      description: "MetaMask development placeholder",
      permissions: ["storage", "activeTab"],
      content_scripts: [{
        matches: ["<all_urls>"],
        js: ["content.js"]
      }]
    };
    
    fs.writeFileSync(
      path.join(metamaskDir, 'manifest.json'),
      JSON.stringify(metamaskManifest, null, 2)
    );
    
    fs.writeFileSync(
      path.join(metamaskDir, 'content.js'),
      '// MetaMask development placeholder\nconsole.log("MetaMask dev extension loaded");'
    );
  }

  // Rabby placeholder
  if (!fs.existsSync(rabbyDir)) {
    fs.mkdirSync(rabbyDir, { recursive: true });
    
    const rabbyManifest = {
      manifest_version: 3,
      name: "Rabby Development",
      version: "1.0.0",
      description: "Rabby wallet development placeholder",
      permissions: ["storage", "activeTab"],
      content_scripts: [{
        matches: ["<all_urls>"],
        js: ["content.js"]
      }]
    };
    
    fs.writeFileSync(
      path.join(rabbyDir, 'manifest.json'),
      JSON.stringify(rabbyManifest, null, 2)
    );
    
    fs.writeFileSync(
      path.join(rabbyDir, 'content.js'),
      '// Rabby wallet development placeholder\nconsole.log("Rabby dev extension loaded");'
    );
  }

  console.log('✅ Created development extension placeholders');
}

// Rome Protocol network configurations
function createNetworkConfigs() {
  const configs = {
    caelian: {
      chainId: '0xDEAD',
      chainName: 'Caelian Testnet',
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: ['https://caelian.testnet.romeprotocol.xyz/'],
      blockExplorerUrls: ['https://caelian-explorer.testnet.romeprotocol.xyz/']
    },
    martis: {
      chainId: '0xDEAE',
      chainName: 'Martis Testnet',
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: ['https://martis.testnet.romeprotocol.xyz/'],
      blockExplorerUrls: ['https://martis-explorer.testnet.romeprotocol.xyz/']
    }
  };

  const configsPath = path.join(extensionsDir, 'network-configs.json');
  fs.writeFileSync(configsPath, JSON.stringify(configs, null, 2));
  
  console.log('✅ Created Rome Protocol network configurations');
  console.log(`📁 Network configs saved to: ${configsPath}`);
}

if (require.main === module) {
  installExtensions()
    .then(() => createNetworkConfigs())
    .catch(console.error);
}