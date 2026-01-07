import { parseEther } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  // Network: Base
  CHAIN_ID: 8453,
  RPC_URL: process.env.BASE_RPC_URL || 
           (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.replace(/https?:\/\/.*\/v2\//, '')}` : 'https://mainnet.base.org'),
  
  // Wallets & Tokens
  CREATOR_ADDRESS: '0xd0dfa0a873e5bcb1b52d42866042ef2859558985' as `0x${string}`,
  TOKEN_LOST_MIDAS: '0xf43a43d8f462e2bba7fb76a1359b8722be09cfa9' as `0x${string}`, // Token to Buy
  TOKEN_ZORA: '0x1111111111166b7fe7bd91427724b487980afc69' as `0x${string}`, // Token used to pay (Protocol Rewards)
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD' as `0x${string}`,
  BASE_ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
  BASE_USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  BASE_WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`,

  // Secrets
  PRIVATE_KEY: process.env.PRIVATE_KEY as `0x${string}`,
  // Ensure we only use the key part if a full URL is provided
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY?.replace(/https?:\/\/.*\/v2\//, ''),
  CODEX_API_KEY: process.env.CODEX_API_KEY,
  ZORA_API_KEY: process.env.ZORA_API_KEY,
  ZERO_EX_API_KEY: process.env.ZERO_EX_API_KEY,

  // Settings
  SLIPPAGE_BPS: 100, // 1%
};

// Tiers from PRD
export const TIERS = [
  { maxVolume: 1000, buybackPercent: 0.10 },    // $0 - $1,000 -> 10%
  { maxVolume: 5000, buybackPercent: 0.20 },    // $1,001 - $5,000 -> 20%
  { maxVolume: 10000, buybackPercent: 0.30 },   // $5,001 - $10,000 -> 30%
  { maxVolume: 25000, buybackPercent: 0.50 },   // $10,001 - $25,000 -> 50%
  { maxVolume: Infinity, buybackPercent: 1.00 },// $25,001+ -> 100%
];

// Fee Revenue % (Standard Zora Protocol Fee is ~0.000777 ETH or similar, but here we calculate based on Volume)
// PRD Example: "$1,000 × 1% fee × 10% = $1.00"
// It implies the "Revenue" is 1% of Volume. 
// We will assume a flat 1% Protocol Reward Fee for calculation purposes as per PRD example.
export const PROTOCOL_FEE_BPS = 100; // 1%

