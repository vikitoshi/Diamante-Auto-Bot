# Diamante Auto Bot

A simple Node.js automation tool for the Diamante Blockchain Airdrop campaign. This script allows you to manage multiple existing wallets, claim faucets, and automate transactions to boost on-chain activity efficiently.

**FULL FEATURE BOT :** [Airdrop Insiders Channel](https://t.me/AirdropInsiderID/3128)

## Features

* **Multi-Wallet Support:** Automatically loads and connects multiple wallets via `.env`.
* **Dashboard:** Displays real-time User ID, Testnet Balance, XP Stats, and Badge Progress.
* **Auto Faucet:** Claim testnet tokens for all loaded wallets in one go.
* **Auto Transactions:**
    * Send to a specific target address.
    * Send to random addresses (automatically generates receiver wallets).
* **Proxy Support:** Supports HTTP/HTTPS proxies for secure connection.

## 🛠 Prerequisites

* Node.js (v16 or higher)
* npm (Node Package Manager)

## 📥 Installation

1. **Clone the repository:**
    ```bash
    git clone https://github.com/vikitoshi/Diamante-Auto-Bot.git
    cd Diamante-Auto-Bot
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

## ⚙️ Configuration

### 1. Private Keys
Create a `.env` file in the root directory and add your private keys sequentially:

```env
PRIVATE_KEY_1=your_private_key_here
PRIVATE_KEY_2=another_private_key_here
PRIVATE_KEY_3=...
```

### 2. Proxies (Optional)
Create a `proxies.txt` file in the root directory to use proxies. Add one proxy per line:

```
http://user:pass@ip:port
http://ip:port
socks5://ip:port
```

If no proxy file is found, the bot will run using your direct IP.

## Usage

Run the script:

```bash
node index.js
```

> **Note:** If you saved the file with a different name, e.g., `wallet.js`, run `node wallet.js`

## 🎮 Menu Options

Once launched, the bot will load your profiles and present the following options:

- **Claim faucet:** Attempts to claim DIAM tokens from the faucet for all wallets.
- **Send DIAM tokens:** Automate transfers to increase transaction count.
- **View wallet info:** Refreshes and shows current stats (XP, Balance, Badges).
- **Back to main menu:** Exits the application.

## ⚠️ Disclaimer

This tool is for educational purposes only. Use it at your own risk. The developer is not responsible for any potential bans or loss of assets.
