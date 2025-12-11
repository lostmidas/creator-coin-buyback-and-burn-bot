# Lost Midas Buyback Mechanism

A TypeScript automation script that monitors trading volume of content coins on Base and executes buybacks of $LOSTMIDAS using 0x API.

## Setup

1. **Install Dependencies**
   ```bash
   cd lost-midas-mechanism
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   BASE_RPC_URL=https://mainnet.base.org
   PRIVATE_KEY=your_wallet_private_key
   ZORA_API_KEY=your_zora_api_key
   ZERO_EX_API_KEY=your_0x_api_key
   ```
   *Note: Ensure the wallet has $ZORA (or ETH) to cover the buyback swaps and gas.*

3. **Configure Settings**
   Edit `src/config.ts` if you need to change:
   - Tiers & Percentages
   - Token Addresses
   - Protocol Fee %

## Usage

Run the script manually:
```bash
npm start
```

## How It Works

1. **Discovery:** Finds coins created by the Creator Address (configured in `src/services/volume.ts`).
2. **Volume Check:** Fetches cumulative volume (currently configured for Uniswap V3 Subgraph on Base).
3. **Calculation:** Applies the PRD Tier Logic to determine buyback amount.
   - Example: First $1k volume -> 10% of generated fees used for buyback.
4. **Execution:** Swaps $ZORA -> $LOSTMIDAS via 0x API.
5. **Burn/Treasury:** Sends bought tokens to the Burn Address (0x...dead).
6. **State:** Saves progress to `data/state.json` to prevent double-buying.

## Logic Details

- **Incremental Processing:** The script tracks `lastProcessedVolume` for each coin. It only buys back for *new* volume since the last run.
- **Tiers:** Tiers are applied cumulatively.
- **Funding:** The script assumes the wallet holds the asset required for the swap (currently configured as $ZORA in `src/config.ts`).

## Notes on Data Sources

- **Volume:** The script currently uses a placeholder for the Uniswap V3 Subgraph. If your coins trade elsewhere, update `src/services/volume.ts`.
- **Coin List:** Currently monitors `$LOSTMIDAS` as a placeholder. Update `getCreatorCoins` in `src/services/volume.ts` to implement dynamic Zora SDK fetching or a static list.

