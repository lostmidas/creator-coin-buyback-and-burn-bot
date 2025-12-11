## **Overview**

The **Lost Midas Buyback & Burn Mechanic** is a revenue-backed automation system designed to reinforce the value of the $lostmidas creator coin by using trading activity from individual content coins on Zora to periodically buy back and burn $lostmidas. This incentivizes deeper engagement, aligns creator and holder interests, and introduces a self-sustaining tokenomic flywheel.

This system operates off-chain via scheduled scripts that monitor trading data, compute eligible buyback amounts using a tiered formula, and execute swaps/burns transparently.

---

## **Goals**

- Create a **self-funding incentive loop** tied directly to content coin activity.
- Grow demand and scarcity for $lostmidas via visible buybacks and burns.
- Showcase progressive mechanism design and onchain economics.
- Maintain low operational overhead with high transparency and flexibility.

---

## **Flywheel Mechanism**

1. Music/content released as content coins on Zora.
2. Traders generate volume → protocol fees paid in $zora.
3. System monitors volume and calculates $zora earned.
4. Periodically buys back $lostmidas using tiered % of earnings.
5. Bought tokens are sent to a burn or treasury wallet.
6. Results in increased demand, reduced supply → boosts token value.

---

## **Buyback Formula**

Buybacks are based on a **progressive tiered band system** that applies increasing buyback %s to volume thresholds.

### **Tier Table:**

| **Tier** | **Volume Range (USD)** | **Buyback % on Band** |
| --- | --- | --- |
| Bronze | $0 – $1,000 | 10% |
| Silver | $1,001 – $5,000 | 20% |
| Gold | $5,001 – $10,000 | 30% |
| Diamond | $10,001 – $25,000 | 50% |
| Platinum | $25,001+ | 100% (manual) |

### **Example: Gold Tier Hit at $10,000**

- Bronze band: $1,000 × 1% fee × 10% = $1.00
- Silver band: $4,000 × 1% fee × 20% = $8.00
- Gold band: $5,000 × 1% fee × 30% = $15.00
    
    **→ Total Buyback: $24.00 worth of $zora → $lostmidas**
    

---

## **Strategy Principles**

- **Self-funded:** No manual capital injection needed.
- **Transparent:** Fully loggable & auditable onchain/offchain.
- **Builder-aligned:** Grows only when post trading grows.
- **Deflationary:** Reduces circulating $lostmidas supply over time.

---

## **Modules & Code Architecture**

All logic runs off-chain in modular scripts. Automation is done via CRON jobs or GitHub Actions.

### **1. volumeFetcher.js**

- Source: Zora Subgraph or API
- Fetches cumulative trading volume per content coin
- Filters out $lostmidas<>USDC pairs (tracks only content coins)
- Outputs: post_id → cumulative_volume

### **2. tierEngine.js**

- Inputs: cumulative volume
- Logic: applies progressive band formula
- Output: % of fee revenue to allocate per post

### **3. feeCalculator.js**

- Calculates fee revenue:
    
    volume × fee % (e.g., 1%)
    
- Optional override per coin
- Outputs: ETH earned per post

### **4. swapExecutor.js**

- Executes $zora → $lostmidas swaps
- Uses: 0x API, CoW Swap, or Uniswap router
- Manages:
    - Private key
    - Slippage config
    - Logs TX hash
- Sends tokens to:
    - Burn wallet (0x000...dead) or
    - Treasury wallet (transparent)

### **5. logger.js**

- Logs all steps to disk/DB
- Includes: timestamp, volume, tx hash, swap result
- Optional: Telegram/Discord alerts

### **6. scheduler.js**

- Triggers job:
    - Daily (default)
    - Hourly (optional for high-frequency)
- Tools: CRON, GitHub Actions, PM2, lightweight VM

---

## **Tech Stack**

| **Component** | **Tools / APIs** |
| --- | --- |
| Fetch Trade Data | Zora API / SDK |
| Swap Execution | 0x API / Web3.js / Ethers.js |
| Scheduling | CRON / GitHub Actions / PM2 |
| State Tracking | JSON / SQLite / Firebase |
| Logging | Console / Telegram / Notion API |

---

## **Automation Flow**

1. **Query** trade volume from Zora
2. **Check** if volume crosses a new tier
3. **Calculate** $zora to allocate for buyback
4. **Execute** swap → $zora → $lostmidas
5. **Send** to burn wallet
6. **Log** transaction for transparency

---

## **Summary**

This off-chain automated buyback system allows Lost Midas to:

- Increase token value and community trust
- Link creator earnings to real-time onchain impact
- Iterate quickly without smart contract constraints
- Demonstrate leading mechanism design on Zora