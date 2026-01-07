# 🪙 Creator Coin Buyback and Burn Script

![Lost Midas Mechanism](./assets/github-repo-cover-image.png)

The Creator Coin Buyback and Burn Script is a revenue-backed automation system designed to reinforce the value of a creator coin. It uses trading activity from individual content coins on Zora to periodically buy back and burn the creator coin. This incentivizes deeper engagement, aligns creator and holder interests, and can create a self-sustaining tokenomics flywheel.

The system runs off-chain via a script that monitors trading data, computes eligible buyback amounts using a configurable tiered formula, and executes swaps and burns transparently.

## 🌟 How It Works

1.  **Monitors Volume:** Tracks the trading volume of your content coins on Zora.
2.  **Claims Rewards:** Automatically claims your earned Protocol Rewards (ETH) from Zora.
3.  **Buys Back:** Uses those rewards to buy your Creator Coin on the open market.
4.  **Burns:** Sends the bought tokens to a burn address (reducing supply) or a treasury.

**It runs entirely on-chain using your own Zora Smart Wallet.**

---

## 🛠️ Setup Guide

### 1. Prerequisites
*   **Node.js** (v18+)
*   A **Zora Creator Account** (with rewards to claim!)
*   A fresh **"Bot Wallet"** (Coinbase, MetaMask, Rainbow, etc.) with ~$5 USD of ETH on Base network.

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

*   `PRIVATE_KEY`: The private key of your **Privy wallet addresst** (NOT your main Zora wallet).
*   `CREATOR_ADDRESS`: Your Zora Creator Address (find this on your Zora profile).
*   `TOKEN_CREATOR`: The contract address of the creator coin you want to buy.
*   `TOKEN_ZORA`: Keep default (Reward token address).
*   `ALCHEMY_API_KEY` / `CODEX_API_KEY`: Get free keys from [Alchemy](https://www.alchemy.com/) and [Codex](https://codex.io/).

### 4. ⚡️ Important: Authorize Your Bot

Your Zora account is likely a "Smart Wallet". You must authorize your Privy Wallet to execute trades on its behalf.

1.  **Export your Privy Key:**
    *   Go to your Zora settings.
    *   Export the "Privy Wallet" private key.
    *   **Check:** Does this exported address match your `CREATOR_ADDRESS`?
        *   **YES?** Use this key as `PRIVATE_KEY` in `.env`. You are done!
        *   **NO?** (Most likely) Proceed to step 2.

2.  **Verify Ownership:**
    *   If your Creator Address is a Smart Contract (starts with `0x...`), your exported Privy key is likely already an **Owner**.
    *   The script automatically detects this and will route transactions through your Smart Wallet.
    *   **Just ensure your Privy Wallet (the one in `.env`) has a small amount of ETH on Base for gas.**

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
*   **Tiers:** Change the buyback % based on volume milestones.
*   **Burn vs Treasury:** Change `BURN_ADDRESS` to your treasury wallet if you prefer to keep the tokens.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Disclaimer:** This software is provided "as is". Use at your own risk. Always test with small amounts first.

