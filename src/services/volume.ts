import { Network, Alchemy } from 'alchemy-sdk';
import { Codex } from '@codex-data/sdk';
import { setApiKey, getProfileCoins } from '@zoralabs/coins-sdk';
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
    
    if (CONFIG.ZORA_API_KEY) {
        setApiKey(CONFIG.ZORA_API_KEY);
    } else {
        console.warn("ZORA_API_KEY is missing. Zora SDK calls might fail.");
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
    
    try {
        const response = await getProfileCoins({
            identifier: CONFIG.CREATOR_ADDRESS,
            count: 50,
            chainIds: [CONFIG.CHAIN_ID]
        });

        if (!response.data) {
            console.error("Zora SDK Error:", (response as any).error);
            return this.getFallbackCoin();
        }

        const edges = response.data.profile?.createdCoins?.edges || [];
        
        if (edges.length === 0) {
             console.log("No coins found via Zora SDK. Using fallback.");
             return this.getFallbackCoin();
        }

        const tokens: TokenInfo[] = edges.map(edge => ({
            address: edge.node.address,
            name: edge.node.name,
            symbol: edge.node.symbol
        }));

        console.log(`Found ${tokens.length} coins via Zora SDK.`);
        return tokens;

    } catch (e) {
        console.warn('Could not fetch coins from Zora SDK, using defaults.', e);
        return this.getFallbackCoin();
    }
  }

  private async getFallbackCoin(): Promise<TokenInfo[]> {
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
        return [
            {
                address: CONFIG.TOKEN_LOST_MIDAS,
                name: 'Lost Midas',
                symbol: 'LM'
            }
        ];
    }
  }

  // 2. Fetch Cumulative Volume using Codex Bars (Historical Trade Volume)
  // This aggregates DEX volume in USD at the time of trade.
  async getCumulativeVolumeUSD(tokenAddress: string): Promise<number> {
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

      interface TokenBarsResponse {
        getTokenBars: {
          volume: (string | null)[];
        } | null;
      }

      console.log(`Fetching historical volume for ${tokenAddress}...`);

      const response = await this.codex.send<TokenBarsResponse>(volumeQuery, {
          symbol: `${tokenAddress}:8453`, // Address:NetworkId for Base
          from: startTime,
          to: now
      });

      const volumes = response.getTokenBars?.volume || [];
      
      // Sum up the volume (strings to float)
      const totalVolumeUSD = volumes.reduce((acc, val) => {
          if (!val) return acc;
          return acc + parseFloat(val);
      }, 0);

      console.log(`Total Historical Volume (USD) for ${tokenAddress}: $${totalVolumeUSD}`);
      return totalVolumeUSD;

    } catch (error: any) {
      console.error(`Error calculating volume for ${tokenAddress}:`, error.message || error);
      return 0;
    }
  }
}
