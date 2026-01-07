import axios from 'axios';
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { CONFIG } from '../config';
import { Codex } from '@codex-data/sdk';
import { withdrawRewards } from "@zoralabs/protocol-sdk";

const ERC20_ABI = [
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: 'success', type: 'bool' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: 'success', type: 'bool' }],
    type: 'function'
  }
] as const;

// Coinbase Smart Wallet ABI (Simplified for execution)
const SMART_WALLET_ABI = parseAbi([
    'function execute(address target, uint256 value, bytes calldata data) payable'
]);

export class SwapService {
  private walletClient;
  private publicClient;
  private account;
  private codex: Codex;

  constructor() {
    this.account = privateKeyToAccount(CONFIG.PRIVATE_KEY);
    
    // Client for writing (Transactions)
    this.walletClient = createWalletClient({
      account: this.account,
      chain: base,
      transport: http(CONFIG.RPC_URL)
    });

    // Client for reading (Public Data)
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(CONFIG.RPC_URL)
    });

    if (!CONFIG.CODEX_API_KEY) {
      throw new Error("CODEX_API_KEY is missing in environment variables.");
    }
    this.codex = new Codex(CONFIG.CODEX_API_KEY);
  }

  // Helper to execute transactions via the Smart Wallet
  async executeViaSmartWallet(target: string, value: bigint, data: string): Promise<`0x${string}`> {
      console.log(`[SmartWallet] Executing tx on ${CONFIG.CREATOR_ADDRESS}...`);
      console.log(`  Target: ${target}`);
      console.log(`  Value: ${value}`);
      
      const hash = await this.walletClient.writeContract({
          address: CONFIG.CREATOR_ADDRESS,
          abi: SMART_WALLET_ABI,
          functionName: 'execute',
          args: [target as `0x${string}`, value, data as `0x${string}`],
          account: this.account
      });
      return hash;
  }

  async executeSwap(amountInETH: number, dryRun: boolean = false): Promise<string | null> {
    try {
        // Step 1: Get $ZORA Price using Codex
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

        interface TokenPricesResponse {
          getTokenPrices: {
            priceUsd: number;
          }[];
        }

        const priceResponse = await this.codex.send<TokenPricesResponse>(priceQuery, {
            address: CONFIG.TOKEN_ZORA,
            networkId: 8453
        });

        const zoraPriceUSD = priceResponse.getTokenPrices?.[0]?.priceUsd || 0;
        
        if (!zoraPriceUSD || zoraPriceUSD === 0) {
            console.error('Failed to fetch ZORA price from Codex');
            return null;
        }

        console.log(`Current ZORA Price (Codex): $${zoraPriceUSD}`);
        console.log(`Buyback Target Amount: $${amountInETH} USD`);

        const zoraAmountToSell = (amountInETH / zoraPriceUSD)/200;
        const sellAmountBigInt = parseUnits(zoraAmountToSell.toFixed(18), 18);

        console.log(`Swap: Selling ${zoraAmountToSell} $ZORA ($${amountInETH} USD) for $LOSTMIDAS`);
        
        // --- NEW STEP: WITHDRAW FROM ZORA WALLET ---
        // Since we are now executing AS the Zora Wallet, we might not need to explicit "Withdraw" 
        // if the wallet already holds the funds. But usually protocol rewards accumulate in the 
        // ProtocolRewards contract, not the wallet itself.
        // So the Smart Wallet must call `withdraw` on the ProtocolRewards contract.
        
        console.log(`Checking withdrawals for Zora Wallet: ${CONFIG.CREATOR_ADDRESS}...`);
        
        if (!dryRun) {
            try {
                // Generate the withdraw transaction data
                // The SDK returns parameters for a standard EOA call. 
                // We need to extract the call data and route it through the Smart Wallet.
                const { parameters } = await withdrawRewards({
                    withdrawFor: CONFIG.CREATOR_ADDRESS,
                    claimSecondaryRoyalties: true,
                    account: CONFIG.CREATOR_ADDRESS, // The Smart Wallet is the caller
                    publicClient: this.publicClient,
                });

                // parameters.functionName, parameters.args etc.
                // We need to encode this ourselves since writeContract does it automatically.
                // But wait, withdrawRewards returns `{ parameters: { address, abi, functionName, args } }`
                
                const withdrawData = encodeFunctionData({
                    abi: parameters.abi,
                    functionName: parameters.functionName,
                    args: parameters.args
                });

                console.log('Sending Withdraw Transaction via Smart Wallet...');
                const withdrawHash = await this.executeViaSmartWallet(
                    parameters.address,
                    0n,
                    withdrawData
                );
                
                console.log(`Withdraw TX Hash: ${withdrawHash}`);
                await this.publicClient.waitForTransactionReceipt({ hash: withdrawHash });
                console.log('Withdraw confirmed.');

            } catch (e: any) {
                 console.warn(`Withdraw failed or no rewards to withdraw: ${e.message}`);
            }
        } else {
             console.log('[Dry Run] Would withdraw rewards via Smart Wallet.');
        }

        console.log({
          sellToken: CONFIG.TOKEN_ZORA,
          buyToken: CONFIG.TOKEN_LOST_MIDAS,
          sellAmount: sellAmountBigInt.toString(),
          takerAddress: CONFIG.CREATOR_ADDRESS, // Swap taker is now the Smart Wallet
      });

        // 2. Get Quote
        // IMPORTANT: The `taker` is now the Smart Wallet, not the Bot Wallet.
        const quoteResponse = await axios.get('https://api.0x.org/swap/allowance-holder/quote', {
            headers: { 
                '0x-api-key': CONFIG.ZERO_EX_API_KEY, 
                '0x-version': 'v2' 
            },
            params: {
                chainId: 8453,
                sellToken: CONFIG.TOKEN_ZORA,
                buyToken: CONFIG.TOKEN_LOST_MIDAS,
                sellAmount: sellAmountBigInt.toString(),
                taker: CONFIG.CREATOR_ADDRESS // Smart Wallet Address
            }
        });

        const quote = quoteResponse.data;
        console.log('Quote Response:', JSON.stringify(quote, null, 2));

        // Fallback for nested transaction object (common in newer 0x APIs)
        // Access fields safely
        const to = quote.to || quote.transaction?.to;
        const data = quote.data || quote.transaction?.data;
        const value = quote.value || quote.transaction?.value;
        const buyAmount = quote.buyAmount || quote.transaction?.buyAmount; // might be in root
        const allowanceTarget = quote.allowanceTarget || quote.transaction?.allowanceTarget || quote.issues?.allowance?.spender;

        if (!to || !data) {
             throw new Error(`Invalid quote response: missing 'to' or 'data'. Received keys: ${Object.keys(quote).join(', ')}`);
        }

        // 3. Approve Token
        // The Smart Wallet must approve the 0x Router to spend its ZORA.
        const allowance = await this.publicClient.readContract({
            address: CONFIG.TOKEN_ZORA,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [CONFIG.CREATOR_ADDRESS, allowanceTarget as `0x${string}`]
        }) as bigint;

        if (allowance < sellAmountBigInt) {
            console.log('Approving 0x Router via Smart Wallet...');
            if (!dryRun) {
                // Encode 'approve' call
                const approveData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [allowanceTarget as `0x${string}`, sellAmountBigInt]
                });

                const hash = await this.executeViaSmartWallet(
                    CONFIG.TOKEN_ZORA,
                    0n,
                    approveData
                );
                
                await this.publicClient.waitForTransactionReceipt({ hash });
                console.log('Approved.');
            } else {
                console.log('[Dry Run] Would approve 0x Router via Smart Wallet.');
            }
        }

        // 4. Execute Swap
        console.log('Executing Swap via Smart Wallet...');
        let txHash: `0x${string}` = '0xDRYRUN_HASH';
        // Ensure value is defined, default to 0
        const valueToSend = value ? BigInt(value) : 0n;

        if (!dryRun) {
            // The data is the call data for the 0x Router.
            // We need to tell the Smart Wallet to call: `to` with `data` and `valueToSend`.
            txHash = await this.executeViaSmartWallet(
                to,
                valueToSend,
                data
            );

            console.log(`Swap Sent! Hash: ${txHash}`);
            await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        } else {
            console.log(`[Dry Run] Would execute swap via Smart Wallet.`);
        }
        
        // 5. Burn Logic
        if (CONFIG.BURN_ADDRESS) {
             const buyAmountBigInt = buyAmount ? BigInt(buyAmount) : 0n;
             console.log(`Burning ${buyAmountBigInt} $LOSTMIDAS...`);
             
             if (!dryRun && buyAmountBigInt > 0n) {
                // Check Smart Wallet Balance
                let retries = 5;
                let balance = 0n;

                while (retries > 0) {
                    balance = await this.publicClient.readContract({
                        address: CONFIG.TOKEN_LOST_MIDAS,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [CONFIG.CREATOR_ADDRESS] // Check Smart Wallet Balance
                    }) as bigint;

                    if (balance >= buyAmountBigInt) break;
                    
                    console.log(`Waiting for balance update... (${retries} retries left)`);
                    await new Promise(r => setTimeout(r, 2000));
                    retries--;
                }

                if (balance < buyAmountBigInt) {
                    console.error(`Insufficient balance to burn. Have: ${balance}, Need: ${buyAmountBigInt}`);
                    if (balance > 0n) {
                        console.log(`Burning available balance: ${balance}`);
                        const burnData = encodeFunctionData({
                            abi: ERC20_ABI,
                            functionName: 'transfer',
                            args: [CONFIG.BURN_ADDRESS, balance]
                        });
                        const burnHash = await this.executeViaSmartWallet(
                            CONFIG.TOKEN_LOST_MIDAS,
                            0n,
                            burnData
                        );
                        console.log(`Burned! Hash: ${burnHash}`);
                    }
                } else {
                    const burnData = encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: 'transfer',
                        args: [CONFIG.BURN_ADDRESS, buyAmountBigInt]
                    });
                    const burnHash = await this.executeViaSmartWallet(
                        CONFIG.TOKEN_LOST_MIDAS,
                        0n,
                        burnData
                    );
                    console.log(`Burned! Hash: ${burnHash}`);
                }
             } else {
                console.log(`[Dry Run] Would burn ${buyAmountBigInt} $LOSTMIDAS via Smart Wallet.`);
             }
        }

        return txHash;

    } catch (error: any) {
        if (error.response) {
            console.error('Swap API Error:', error.response.data);
            console.log(error.response.data.data.details);
        } else {
            console.error('Swap Error:', error.message);
        }
        return null;
    }
  }
}
