const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

const logger = {
  info: (msg) => console.log(`${colors.white}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[→] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`------------------------------------------`);
    console.log(` Diamante Auto Bot - Airdrop Insiders`);
    console.log(`------------------------------------------${colors.reset}`);
  },
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const API_BASE = "https://campapi.diamante.io/api/v1";

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
  }

  async loadProxies() {
    try {
      const data = await fs.readFile('proxies.txt', 'utf-8');
      this.proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(proxy => this.parseProxy(proxy));
      
      logger.info(`Loaded ${this.proxies.length} proxies`);
      return this.proxies.length > 0;
    } catch (error) {
      logger.warn('No proxies.txt found or error reading file. Running without proxy.');
      return false;
    }
  }

  parseProxy(proxyString) {
    try {
      if (proxyString.startsWith('http://') || proxyString.startsWith('https://') || proxyString.startsWith('socks://')) {
        return proxyString;
      }

      const parts = proxyString.split(':');
      
      if (parts.length === 2) {
        return `http://${parts[0]}:${parts[1]}`;
      } else if (parts.length === 4) {
        return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
      } else if (proxyString.includes('@')) {
        return `http://${proxyString}`;
      }
      
      return `http://${proxyString}`;
    } catch (error) {
      logger.error(`Failed to parse proxy: ${proxyString}`);
      return null;
    }
  }

  getNextProxy() {
    if (this.proxies.length === 0) return null;
    
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
}

class DiamanteBotClient {
  constructor(privateKey, proxy = null) {
    try {
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(formattedKey);
      this.address = this.wallet.address;
      this.privateKey = this.wallet.privateKey;
    } catch (error) {
      throw new Error(`Invalid private key: ${error.message}`);
    }
    
    this.userId = null;
    this.accessToken = null;
    this.testnetAddress = null;
    this.proxy = proxy;
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  getAxiosConfig() {
    const config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'access-token': 'key',
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        'origin': 'https://campaign.diamante.io',
        'referer': 'https://campaign.diamante.io/',
      },
      timeout: 30000
    };

    if (this.accessToken) {
      config.headers['cookie'] = `access_token=${this.accessToken}`;
    }

    if (this.proxy) {
      config.httpsAgent = new HttpsProxyAgent(this.proxy);
      config.httpAgent = new HttpsProxyAgent(this.proxy);
    }

    return config;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryRequest(requestFn, maxRetries = 20, initialDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        const isRateLimit = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        
        if (attempt === maxRetries) {
          throw error;
        }

        if (isRateLimit || isServerError) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  generateRandomLocation() {
    const locations = [
      { name: "New York, USA", lat: [40.5, 41.0], lon: [-74.5, -73.5] },
      { name: "London, UK", lat: [51.3, 51.7], lon: [-0.5, 0.3] },
      { name: "Tokyo, Japan", lat: [35.5, 35.8], lon: [139.5, 139.9] },
      { name: "Singapore", lat: [1.2, 1.5], lon: [103.6, 104.0] }
    ];

    const location = locations[Math.floor(Math.random() * locations.length)];
    
    const latitude = (Math.random() * (location.lat[1] - location.lat[0]) + location.lat[0]).toFixed(7);
    const longitude = (Math.random() * (location.lon[1] - location.lon[0]) + location.lon[0]).toFixed(7);
    
    return { 
      latitude: parseFloat(latitude), 
      longitude: parseFloat(longitude),
      locationName: location.name
    };
  }

  async connectWallet() {
    try {
      logger.loading(`Connecting wallet ${this.address.slice(0, 6)}...${this.address.slice(-4)}`);
      
      const deviceId = `DEV${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const location = this.generateRandomLocation();
      
      const payload = {
        address: this.address,
        deviceId,
        deviceSource: "web_app",
        deviceType: "Windows",
        browser: "Chrome",
        ipAddress: "0.0.0.0",
        latitude: location.latitude,
        longitude: location.longitude,
        countryCode: "Unknown",
        country: "Unknown",
        continent: "Unknown",
        continentCode: "Unknown",
        region: "Unknown",
        regionCode: "Unknown",
        city: "Unknown"
      };

      const response = await this.retryRequest(async () => {
        return await axios.post(
          `${API_BASE}/user/connect-wallet`,
          payload,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        this.userId = response.data.data.userId;
        this.testnetAddress = response.data.data.testnetWalletAddress;
        
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          const tokenCookie = cookies.find(c => c.startsWith('access_token='));
          if (tokenCookie) {
            this.accessToken = tokenCookie.split(';')[0].split('=')[1];
          }
        }
        return response.data.data;
      }
      
      return null;
    } catch (error) {
      logger.error(`Connect wallet failed: ${error.message}`);
      return null;
    }
  }

  async getUserStatus() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/auth/get-user-status/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Get status failed: ${error.message}`);
      return null;
    }
  }

  async getXPStats() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/xp/stats/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      logger.error(`Get XP stats failed: ${error.message}`);
      return null;
    }
  }

  async getBalance() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/transaction/get-balance/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        return response.data.data.balance;
      }
      return 0;
    } catch (error) {
      logger.error(`Get balance failed: ${error.message}`);
      return 0;
    }
  }

  async claimFaucet() {
    try {
      logger.loading('Claiming testnet tokens from faucet...');
      
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/transaction/fund-wallet/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const { fundedAmount, finalBalance } = response.data.data;
        logger.success(`Claimed ${fundedAmount} tokens! Balance: ${finalBalance}`);
        return { success: true, balance: finalBalance };
      } else {
        logger.warn(response.data.message);
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      if (error.response?.data?.message) {
        logger.warn(error.response.data.message);
      } else {
        logger.error(`Claim failed: ${error.message}`);
      }
      return { success: false };
    }
  }

  async sendTransaction(toAddress, amount) {
    try {
      logger.loading(`Sending ${amount} tokens to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}...`);
      
      const payload = {
        toAddress,
        amount: parseFloat(amount),
        userId: this.userId
      };

      const response = await this.retryRequest(async () => {
        return await axios.post(
          `${API_BASE}/transaction/transfer`,
          payload,
          this.getAxiosConfig()
        );
      }, 20, 2000);

      if (response.data.success) {
        const hash = response.data.data.transferData.hash;
        logger.success(`Transaction sent! Hash: ${hash}`);
        return { success: true, hash };
      }

      return { success: false };
    } catch (error) {
      logger.error(`Transaction failed: ${error.message}`);
      return { success: false };
    }
  }

  displayUserInfo(status, xpStats, balance) {
    console.log(`\n${colors.cyan}${colors.bold}${'-'.repeat(60)}`);
    console.log(`                    WALLET INFORMATION`);
    console.log(`${'-'.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.white}Address:${colors.reset}         ${this.address}`);
    console.log(`${colors.white}User ID:${colors.reset}         ${this.userId}`);
    console.log(`${colors.white}Testnet Address:${colors.reset} ${this.testnetAddress}`);
    console.log(`${colors.white}Balance:${colors.reset}         ${balance} DIAM`);
    console.log(`${colors.white}Transactions:${colors.reset}    ${status?.transactionCount || 0}`);
    
    if (xpStats) {
      console.log(`\n${colors.yellow}${colors.bold}XP STATS:${colors.reset}`);
      console.log(`${colors.white}Total XP:${colors.reset}         ${xpStats.totalXP}`);
      console.log(`${colors.white}Multiplier:${colors.reset}       ${xpStats.currentMultiplier}x`);
      
      if (xpStats.badgeHistory && xpStats.badgeHistory.length > 0) {
        console.log(`\n${colors.magenta}${colors.bold}BADGE PROGRESS:${colors.reset}`);
        xpStats.badgeHistory.forEach(badge => {
          const progressBar = '█'.repeat(Math.floor(badge.progress / 100)) + '░'.repeat(10 - Math.floor(badge.progress / 100));
          const status = badge.isComplete ? '✅' : badge.isNextBadge ? '🎯' : '⏳';
          console.log(`${status} ${badge.badgeType.padEnd(8)} [${progressBar}] ${badge.progress}/${badge.requiredTransactions} `);
        });
      }
    }
    console.log(`\n${colors.cyan}${'-'.repeat(60)}${colors.reset}\n`);
  }
}

async function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function generateRandomWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

async function saveRandomWalletToFile(address, privateKey) {
  try {
    const walletData = `Address: ${address}\nPrivate Key: ${privateKey}\nGenerated at: ${new Date().toISOString()}\n${'='.repeat(80)}\n`;
    await fs.appendFile('wallet_receive_diam.txt', walletData);
    logger.info('Random wallet saved to wallet_receive_diam.txt');
  } catch (error) {
    logger.error(`Failed to save wallet: ${error.message}`);
  }
}

function loadPrivateKeysFromEnv() {
  const privateKeys = [];
  let index = 1;
  while (true) {
    const key = process.env[`PRIVATE_KEY_${index}`];
    if (!key) break;
    privateKeys.push(key);
    index++;
  }
  return privateKeys;
}

async function showWalletMenu() {
  console.log(`\n${colors.cyan}${colors.bold}WALLET ACTIONS:${colors.reset}`);
  console.log(`${colors.white}1.${colors.reset} Claim faucet`);
  console.log(`${colors.white}2.${colors.reset} Send DIAM tokens`);
  console.log(`${colors.white}3.${colors.reset} View wallet info`);
  console.log(`${colors.white}4.${colors.reset} Back to main menu (Exit)\n`);
  
  const choice = await question('Select action (1-4): ');
  return choice.trim();
}

async function main() {
  logger.banner();
  
  const proxyManager = new ProxyManager();
  await proxyManager.loadProxies();

  const envKeys = loadPrivateKeysFromEnv();
  
  if (envKeys.length === 0) {
    logger.error('No private keys found in .env file (PRIVATE_KEY_1, PRIVATE_KEY_2, etc.)');
    return;
  }

  logger.info(`Found ${envKeys.length} wallet(s) in .env`);
  const clients = [];

  for (let i = 0; i < envKeys.length; i++) {
    try {
      const proxy = proxyManager.getNextProxy();
      const client = new DiamanteBotClient(envKeys[i], proxy);
      
      logger.loading(`Loading wallet ${i + 1}/${envKeys.length}...`);
      
      const connectResult = await client.connectWallet();
      if (connectResult) {
        await client.sleep(1000);
        const status = await client.getUserStatus();
        const xpStats = await client.getXPStats();
        const balance = await client.getBalance();

        client.displayUserInfo(status, xpStats, balance);
        clients.push(client);
      } else {
          logger.error(`Failed to connect wallet ${i + 1}`);
      }
      
      await client.sleep(1500);
    } catch (error) {
      logger.error(`Error loading wallet ${i + 1}: ${error.message}`);
    }
  }

  if (clients.length === 0) {
    logger.error('No wallets loaded successfully. Exiting.');
    return;
  }

  while (true) {
    const action = await showWalletMenu();

    if (action === '4') {
        logger.info('Exiting. Goodbye!');
        process.exit(0);
    }

    switch (action) {
      case '1':
        logger.info('Claiming faucet for all wallets...\n');
        for (let i = 0; i < clients.length; i++) {
          logger.info(`Wallet ${i + 1}/${clients.length}: ${clients[i].address}`);
          await clients[i].claimFaucet();
          await clients[i].sleep(2000);
        }
        logger.success('Faucet claim completed for all wallets!');
        break;

      case '2':
        const sendType = await question('Send to (1) Specified Address or (2) Random Address? (1/2): ');
        let targetAddr = null;
        const randomWallets = [];
        
        if (sendType === '1') {
          targetAddr = await question('Enter target address: ');
          if (!ethers.isAddress(targetAddr)) {
            logger.error('Invalid address');
            break;
          }
        } else if (sendType === '2') {
          for (let i = 0; i < clients.length; i++) {
            const randomWallet = await generateRandomWallet();
            randomWallets.push(randomWallet);
            await saveRandomWalletToFile(randomWallet.address, randomWallet.privateKey);
          }
          logger.success(`Generated ${randomWallets.length} random receiver wallets`);
        } else {
          logger.error('Invalid option');
          break;
        }

        const amount = await question('Enter amount of DIAM to send: ');
        const sendAmount = parseFloat(amount);
        
        if (isNaN(sendAmount) || sendAmount <= 0) {
          logger.error('Invalid amount');
          break;
        }

        const txCount = await question('Enter number of transactions per wallet: ');
        const transactionCount = parseInt(txCount);
        
        if (isNaN(transactionCount) || transactionCount < 1) {
          logger.error('Invalid transaction count');
          break;
        }

        logger.info(`Sending ${sendAmount} DIAM for ${transactionCount} transaction(s) per wallet...\n`);
        
        for (let i = 0; i < clients.length; i++) {
          logger.info(`Processing Wallet ${i + 1}/${clients.length}: ${clients[i].address}`);
          
          for (let tx = 0; tx < transactionCount; tx++) {
            const destination = sendType === '1' ? targetAddr : randomWallets[i].address;
            
            logger.info(`Transaction ${tx + 1}/${transactionCount}`);
            const result = await clients[i].sendTransaction(destination, sendAmount);
            
            if (result.success) {
              logger.success(`Transaction ${tx + 1} successful!`);
            } else {
              logger.error(`❌ Transaction ${tx + 1} failed`);
            }

            if (tx < transactionCount - 1 || i < clients.length - 1) {
              logger.loading('Waiting 5 seconds before next transaction...');
              await clients[i].sleep(5000);
            }
          }
          logger.success(`Completed all transactions for wallet ${i + 1}`);
        }
        logger.success('🎉 All transactions completed for all wallets!');
        break;

      case '3':
        logger.info('Refreshing wallet info...\n');
        for (let i = 0; i < clients.length; i++) {
          const status = await clients[i].getUserStatus();
          const xpStats = await clients[i].getXPStats();
          const balance = await clients[i].getBalance();
          clients[i].displayUserInfo(status, xpStats, balance);
          await clients[i].sleep(1000);
        }
        break;

      default:
        logger.warn('Invalid option');
    }
  }
}

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error.message}`);
});

main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});