"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const volume_1 = require("./services/volume");
const calculator_1 = require("./services/calculator");
const swap_1 = require("./services/swap");
const state_1 = require("./utils/state");
async function main() {
    const dryRun = process.argv.includes('--dry-run');
    if (dryRun)
        console.log('>>> DRY RUN MODE ENABLED: No transactions will be sent. State will not be saved. <<<');
    console.log('--- Starting Lost Midas Buyback Script ---');
    // Initialize Services
    const volumeService = new volume_1.VolumeService();
    const tierEngine = new calculator_1.TierEngine();
    const swapService = new swap_1.SwapService();
    // Load State
    const state = await (0, state_1.loadState)();
    // Get Coins to Monitor
    const coins = await volumeService.getCreatorCoins();
    for (const coin of coins) {
        console.log(`\nProcessing Coin: ${coin.name} (${coin.address})`);
        // 1. Fetch Current Volume
        const currentVolume = await volumeService.getCumulativeVolumeUSD(coin.address);
        console.log(`Current Volume: $${currentVolume.toFixed(2)}`);
        // 2. Get Last Processed Volume
        const coinState = state.coins[coin.address] || {
            cumulativeVolumeUSD: 0,
            lastProcessedVolumeUSD: 0,
            totalBuybackETH: 0
        };
        console.log(`Last Processed: $${coinState.lastProcessedVolumeUSD.toFixed(2)}`);
        // 3. Calculate Buyback
        const buybackUSD = tierEngine.calculateBuyback(currentVolume, coinState.lastProcessedVolumeUSD);
        if (buybackUSD > 0.01) { // Min threshold to avoid dust errors
            console.log(`>> Buyback Required: $${buybackUSD.toFixed(4)} USD`);
            // 4. Execute Swap
            const txHash = await swapService.executeSwap(buybackUSD, dryRun);
            if (txHash) {
                // 5. Update State
                coinState.lastProcessedVolumeUSD = currentVolume;
                coinState.cumulativeVolumeUSD = currentVolume;
                state.coins[coin.address] = coinState;
                console.log('State updated.');
            }
            else {
                console.error('Swap failed. State not updated.');
            }
        }
        else {
            console.log('No buyback needed (below threshold or no new volume).');
            // Still update cumulative volume for tracking
            coinState.cumulativeVolumeUSD = currentVolume;
            state.coins[coin.address] = coinState;
        }
    }
    // Save State
    if (!dryRun) {
        state.lastRunTimestamp = Date.now();
        await (0, state_1.saveState)(state);
    }
    else {
        console.log('Dry run completed. State not saved.');
    }
    console.log('\n--- Script Finished ---');
}
main().catch(console.error);
