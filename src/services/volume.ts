import { Network, Alchemy, AssetTransfersCategory, AssetTransfersResponse } from 'alchemy-sdk';
import { Codex } from '@codex-data/sdk';
import { CONFIG } from '../config';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export class VolumeService {
  private alchemy: Alchemy;
  private codex: Codex;

  constructor() {
    if (!CONFIG.ALCHEMY_API_KEY) {
        throw new Error("ALCHEMY_API_KEY is missing in environment variables.");
    }
    if (!CONFIG.CODEX_API_KEY) {
        throw new Error("CODEX_API_KEY is missing in environment variables.");
    }
    
    this.alchemy = new Alchemy({
        apiKey: CONFIG.ALCHEMY_API_KEY,
        network: Network.BASE_MAINNET,
    });

    this.codex = new Codex(CONFIG.CODEX_API_KEY);
  }
  
  // 1. Discover Coins created by our Creator
  async getCreatorCoins(): Promise<TokenInfo[]> {
    console.log(`Fetching coins for creator: ${CONFIG.CREATOR_ADDRESS}...`);
    
    // We can fetch metadata for the known token using Alchemy
    // Note: If this fails repeatedly, we can hardcode or use Codex metadata
    try {
        const metadata = await this.alchemy.core.getTokenMetadata(CONFIG.TOKEN_LOST_MIDAS);
        return [
          {
            address: CONFIG.TOKEN_LOST_MIDAS, 
            name: metadata.name || 'Lost Midas',
            symbol: metadata.symbol || 'LM'
          }
        ];
    } catch (e) {
        console.warn('Could not fetch metadata from Alchemy, using defaults.');
        return [
            {
                address: CONFIG.TOKEN_LOST_MIDAS,
                name: 'Lost Midas',
                symbol: 'LM'
            }
        ];
    }
  }

  // 2. Fetch Cumulative Volume using Alchemy + Codex Price
  async getCumulativeVolumeUSD(tokenAddress: string): Promise<number> {
    try {
      // A. Get Total Token Transfer Volume
      let totalTokensTransferred = 0;
      let pageKey: string | undefined = undefined;
      
      do {
          const res: AssetTransfersResponse = await this.alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            contractAddresses: [tokenAddress],
            category: [AssetTransfersCategory.ERC20],
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

      // Define expected response type for proper type checking
      interface TokenPricesResponse {
        getTokenPrices: {
          priceUsd: number;
          timestamp: string;
          address: string;
        }[];
      }

      const response = await this.codex.send<TokenPricesResponse>(priceQuery, {
          address: tokenAddress,
          networkId: 8453
      });
      
      const priceUSD = response.getTokenPrices?.[0]?.priceUsd || 0;
      
      console.log(`Current Price (Codex): $${priceUSD}`);
      
      const totalVolumeUSD = totalTokensTransferred * priceUSD;
      return totalVolumeUSD;

    } catch (error: any) {
      console.error(`Error calculating volume for ${tokenAddress}:`, error.message || error);
      return 0;
    }
  }
}
