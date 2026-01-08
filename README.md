# 🪙 Creator Coin Buyback and Burn Script

![Lost Midas Mechanism](./assets/github-repo-cover-image.png)

The Creator Coin Buyback and Burn Bot is an off-chain script that uses trading fees from your Zora content coins to automatically buy back and burn your creator coin. It watches trading activity, calculates how much to spend using a configurable tiered formula, then runs swaps onchain through your **Zora wallet** (Smart Wallet) and sends the purchased coins to a burn address.

## 🌟 How It Works

1.  **Monitors Volume:** Tracks the trading volume of your content coins on Zora.
2.  **Claims Rewards:** Automatically claims your earned Protocol Rewards (ETH) from Zora.
3.  **Buys Back:** Uses those rewards to buy your Creator Coin on the open market.
4.  **Burns:** Sends the bought tokens to a burn address (reducing supply) or a treasury.

---

## 🛠️ Setup Guide

### 1. Prerequisites
*   **Node.js** (v18+)
*   A **Zora Creator Account** (with rewards to claim!)
*   **A Funded Wallet:** You need the Private Key of your **Privy wallet address** (which is an **Owner** of your Zora wallet address). It needs ~$5 USD of ETH on Base to pay for gas.

### 2. Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/lostmidas/creator-coin-buyback-and-burn-script
cd creator-coin-buyback-and-burn-script
npm install
```

### 3. Configuration

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

**Fill in the following values:**

*   `PRIVATE_KEY`: The private key of your **Privy wallet address** (NOT your Zora wallet address).
    **Never commit this file. This key controls an owner wallet for your account.**
*   `CREATOR_ADDRESS`: Your **Zora wallet address** (find this on your Zora profile settings).
*   `TOKEN_CREATOR`: The contract address of the creator coin you want to buy.
*   `TOKEN_ZORA`: Keep default (Reward token address).
*   `ALCHEMY_API_KEY` / `CODEX_API_KEY`: Get free keys from [Alchemy](https://www.alchemy.com/) and [Codex](https://codex.io/).

### 4. ⚡️ Important: Authorize Your Bot

Your **Zora wallet** is a Smart Account. You must authorize your **Privy wallet** to execute trades on its behalf.

1.  **Export your Privy Key:**
    *   Go to your Zora settings.
    *   Find the **"Privy wallet address"** section.
    *   Click **"Export privy wallet"** to get your private key.
    *   **Check:** Your exported **Privy wallet address** (EOA) will be DIFFERENT from your **Zora wallet address** (Smart Contract). This is normal. The script uses the Privy key to control the Zora wallet.

2.  **Verify Ownership:**
    *   The script automatically detects that your **Privy wallet** is an owner of your **Zora wallet**.
    *   It will route transactions through your Zora wallet to use its accumulated rewards.
    *   **Just ensure your Privy wallet address (the one in `.env`) has a small amount of ETH on Base for gas.**

### 5. Run It!

**Dry Run (Test Mode):**
See what would happen without spending real money.
```bash
npm start -- --dry-run
```

**Live Mode:**
Execute the buyback and burn.
```bash
npm start
```

---

## 🤖 Automation

To keep the flywheel spinning, set this up to run daily using a cron job or a process manager like PM2:

```bash
# Run every day at midnight
0 0 * * * cd /path/to/repo && npm start
```

## ⚙️ Customization

Edit `src/config.ts` to tweak:
*  **Tiers:** Configure volume bands and buyback percentages  
  _(e.g. low volume = 10% of rewards, higher volume = 30–50% of rewards)_
* **Burn vs Treasury:** Change `BURN_ADDRESS` to your treasury wallet if you prefer to keep the tokens.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Disclaimer:** This software is provided "as is". Use at your own risk. Always test with small amounts first.
