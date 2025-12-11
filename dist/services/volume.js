"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeService = void 0;
const alchemy_sdk_1 = require("alchemy-sdk");
const sdk_1 = require("@codex-data/sdk");
const config_1 = require("../config");
class VolumeService {
    constructor() {
        if (!config_1.CONFIG.ALCHEMY_API_KEY) {
            throw new Error("ALCHEMY_API_KEY is missing in environment variables.");
        }
        if (!config_1.CONFIG.CODEX_API_KEY) {
            throw new Error("CODEX_API_KEY is missing in environment variables.");
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
        // We can fetch metadata for the known token using Alchemy
        // Note: If this fails repeatedly, we can hardcode or use Codex metadata
        try {
            const metadata = await this.alchemy.core.getTokenMetadata(config_1.CONFIG.TOKEN_LOST_MIDAS);
            return [
                {
                    address: config_1.CONFIG.TOKEN_LOST_MIDAS,
                    name: metadata.name || 'Lost Midas',
                    symbol: metadata.symbol || 'LM'
                }
            ];
        }
        catch (e) {
            console.warn('Could not fetch metadata from Alchemy, using defaults.');
            return [
                {
                    address: config_1.CONFIG.TOKEN_LOST_MIDAS,
                    name: 'Lost Midas',
                    symbol: 'LM'
                }
            ];
        }
    }
    // 2. Fetch Cumulative Volume using Alchemy + Codex Price
    async getCumulativeVolumeUSD(tokenAddress) {
        try {
            // A. Get Total Token Transfer Volume
            let totalTokensTransferred = 0;
            let pageKey = undefined;
            do {
                const res = await this.alchemy.core.getAssetTransfers({
                    fromBlock: "0x0",
                    contractAddresses: [tokenAddress],
                    category: [alchemy_sdk_1.AssetTransfersCategory.ERC20],
                    excludeZeroValue: true,
                    pageKey: pageKey
                });
                for (const transfer of res.transfers) {
                    if (transfer.value) {
                        totalTokensTransferred += transfer.value;
                    }
                }
                pageKey = res.pageKey;
            } while (pageKey);
            console.log(`Total Transfer Volume (Tokens): ${totalTokensTransferred}`);
            // B. Get Current Token Price (USD) via Codex API
            // Query: 
            // networkId: 8453 (Base)
            // address: tokenAddress
            const priceQuery = `
        query TokenPrice($address: String!, $networkId: Int!) {
            getTokenPrices(
                inputs: [
                    { address: $address, networkId: $networkId }
                ]
            ) {
                priceUsd
            }
        }
      `;
            const response = await this.codex.send(priceQuery, {
                address: tokenAddress,
                networkId: 8453
            });
            const priceUSD = response.getTokenPrices?.[0]?.priceUsd || 0;
            console.log(`Current Price (Codex): $${priceUSD}`);
            const totalVolumeUSD = totalTokensTransferred * priceUSD;
            return totalVolumeUSD;
        }
        catch (error) {
            console.error(`Error calculating volume for ${tokenAddress}:`, error.message || error);
            return 0;
        }
    }
}
exports.VolumeService = VolumeService;
