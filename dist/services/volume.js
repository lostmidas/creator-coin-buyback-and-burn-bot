"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeService = void 0;
const alchemy_sdk_1 = require("alchemy-sdk");
const sdk_1 = require("@codex-data/sdk");
const coins_sdk_1 = require("@zoralabs/coins-sdk");
const config_1 = require("../config");
class VolumeService {
    constructor() {
        if (!config_1.CONFIG.ALCHEMY_API_KEY) {
            throw new Error("ALCHEMY_API_KEY is missing in environment variables.");
        }
        if (!config_1.CONFIG.CODEX_API_KEY) {
            throw new Error("CODEX_API_KEY is missing in environment variables.");
        }
        if (config_1.CONFIG.ZORA_API_KEY) {
            (0, coins_sdk_1.setApiKey)(config_1.CONFIG.ZORA_API_KEY);
        }
        else {
            console.warn("ZORA_API_KEY is missing. Zora SDK calls might fail.");
        }
        this.alchemy = new alchemy_sdk_1.Alchemy({
            apiKey: config_1.CONFIG.ALCHEMY_API_KEY,
            network: alchemy_sdk_1.Network.BASE_MAINNET,
        });
        this.codex = new sdk_1.Codex(config_1.CONFIG.CODEX_API_KEY);
    }
    // 1. Discover Coins created by our Creator
    async getCreatorCoins() {
        console.log(`Fetching coins for creator: ${config_1.CONFIG.CREATOR_ADDRESS}...`);
        try {
            const response = await (0, coins_sdk_1.getProfileCoins)({
                identifier: config_1.CONFIG.CREATOR_ADDRESS,
                count: 50,
                chainIds: [config_1.CONFIG.CHAIN_ID]
            });
            if (!response.data) {
                console.error("Zora SDK Error:", response.error);
                return this.getFallbackCoin();
            }
            const edges = response.data.profile?.createdCoins?.edges || [];
            if (edges.length === 0) {
                console.log("No coins found via Zora SDK. Using fallback.");
                return this.getFallbackCoin();
            }
            const tokens = edges.map(edge => ({
                address: edge.node.address,
                name: edge.node.name,
                symbol: edge.node.symbol
            }));
            console.log(`Found ${tokens.length} coins via Zora SDK.`);
            return tokens;
        }
        catch (e) {
            console.warn('Could not fetch coins from Zora SDK, using defaults.', e);
            return this.getFallbackCoin();
        }
    }
    async getFallbackCoin() {
        try {
            const metadata = await this.alchemy.core.getTokenMetadata(config_1.CONFIG.TOKEN_CREATOR);
            return [
                {
                    address: config_1.CONFIG.TOKEN_CREATOR,
                    name: metadata.name || 'Lost Midas',
                    symbol: metadata.symbol || 'LM'
                }
            ];
        }
        catch (e) {
            return [
                {
                    address: config_1.CONFIG.TOKEN_CREATOR,
                    name: 'Lost Midas',
                    symbol: 'LM'
                }
            ];
        }
    }
    // 2. Fetch Cumulative Volume using Codex Bars (Historical Trade Volume)
    // This aggregates DEX volume in USD at the time of trade.
    async getCumulativeVolumeUSD(tokenAddress) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const startTime = 1748736000; // June 1, 2025 (Project Inception)
            const volumeQuery = `
        query TokenVolume($symbol: String!, $from: Int!, $to: Int!) {
            getTokenBars(
                symbol: $symbol
                resolution: "1D"
                from: $from
                to: $to
                currencyCode: USD
            ) {
                volume
            }
        }
      `;
            console.log(`Fetching historical volume for ${tokenAddress}...`);
            const response = await this.codex.send(volumeQuery, {
                symbol: `${tokenAddress}:8453`, // Address:NetworkId for Base
                from: startTime,
                to: now
            });
            const volumes = response.getTokenBars?.volume || [];
            // Sum up the volume (strings to float)
            const totalVolumeUSD = volumes.reduce((acc, val) => {
                if (!val)
                    return acc;
                return acc + parseFloat(val);
            }, 0);
            console.log(`Total Historical Volume (USD) for ${tokenAddress}: $${totalVolumeUSD}`);
            return totalVolumeUSD;
        }
        catch (error) {
            console.error(`Error calculating volume for ${tokenAddress}:`, error.message || error);
            return 0;
        }
    }
}
exports.VolumeService = VolumeService;
