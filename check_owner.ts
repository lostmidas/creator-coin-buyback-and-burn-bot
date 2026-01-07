
import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { CONFIG } from './src/config';

// Common Smart Wallet ABIs
const COINBASE_WALLET_ABI = parseAbi([
  'function isOwnerAddress(address) view returns (bool)',
  'function owner() view returns (address)',
  'function owners(uint256) view returns (address)' // Sometimes array
]);

const SAFE_ABI = parseAbi([
  'function isOwner(address) view returns (bool)',
  'function getOwners() view returns (address[])'
]);

async function main() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(CONFIG.RPC_URL)
  });

  const creatorAddress = CONFIG.CREATOR_ADDRESS;
  const botAddress = '0xd030270B5fD9885DdFB8ED662344fbAdE8274D3e'; // Address corresponding to your .env key

  console.log(`Checking permissions for Bot: ${botAddress}`);
  console.log(`Target Smart Wallet: ${creatorAddress}`);

  // Check 1: Coinbase Smart Wallet (isOwnerAddress)
  try {
    const isOwner = await publicClient.readContract({
      address: creatorAddress,
      abi: COINBASE_WALLET_ABI,
      functionName: 'isOwnerAddress',
      args: [botAddress]
    });
    console.log(`[Coinbase Check] isOwnerAddress(${botAddress}): ${isOwner}`);
    if (isOwner) {
        console.log(">>> SUCCESS: Wallet is a Coinbase Smart Wallet and Bot is an owner!");
        return;
    }
  } catch (e) {
    console.log('[Coinbase Check] Failed (likely not this wallet type)');
  }

  // Check 2: Safe (isOwner)
  try {
    const isOwner = await publicClient.readContract({
      address: creatorAddress,
      abi: SAFE_ABI,
      functionName: 'isOwner',
      args: [botAddress]
    });
    console.log(`[Safe Check] isOwner(${botAddress}): ${isOwner}`);
    if (isOwner) {
        console.log(">>> SUCCESS: Wallet is a Safe and Bot is an owner!");
        return;
    }
  } catch (e) {
    console.log('[Safe Check] Failed (likely not this wallet type)');
  }

  console.log(">>> CONCLUSION: Bot is NOT an owner on standard interfaces, or wallet type is unknown.");
}

main().catch(console.error);

