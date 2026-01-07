"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapService = void 0;
const axios_1 = __importDefault(require("axios"));
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const config_1 = require("../config");
const sdk_1 = require("@codex-data/sdk");
const protocol_sdk_1 = require("@zoralabs/protocol-sdk");
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
];
class SwapService {
    constructor() {
        this.account = (0, accounts_1.privateKeyToAccount)(config_1.CONFIG.PRIVATE_KEY);
        // Client for writing (Transactions)
        this.walletClient = (0, viem_1.createWalletClient)({
            account: this.account,
            chain: chains_1.base,
            transport: (0, viem_1.http)(config_1.CONFIG.RPC_URL)
        });
        // Client for reading (Public Data)
        this.publicClient = (0, viem_1.createPublicClient)({
            chain: chains_1.base,
            transport: (0, viem_1.http)(config_1.CONFIG.RPC_URL)
        });
        if (!config_1.CONFIG.CODEX_API_KEY) {
            throw new Error("CODEX_API_KEY is missing in environment variables.");
        }
        this.codex = new sdk_1.Codex(config_1.CONFIG.CODEX_API_KEY);
    }
    async executeSwap(amountInETH, dryRun = false) {
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
            const priceResponse = await this.codex.send(priceQuery, {
                address: config_1.CONFIG.TOKEN_ZORA,
                networkId: 8453
            });
            const zoraPriceUSD = priceResponse.getTokenPrices?.[0]?.priceUsd || 0;
            if (!zoraPriceUSD || zoraPriceUSD === 0) {
                console.error('Failed to fetch ZORA price from Codex');
                return null;
            }
            console.log(`Current ZORA Price (Codex): $${zoraPriceUSD}`);
            console.log(`Buyback Target Amount: $${amountInETH} USD`);
            const zoraAmountToSell = (amountInETH / zoraPriceUSD) / 200;
            const sellAmountBigInt = (0, viem_1.parseUnits)(zoraAmountToSell.toFixed(18), 18);
            console.log(`Swap: Selling ${zoraAmountToSell} $ZORA ($${amountInETH} USD) for $LOSTMIDAS`);
            // --- NEW STEP: WITHDRAW FROM ZORA WALLET ---
            console.log(`Checking withdrawals for Zora Wallet: ${config_1.CONFIG.CREATOR_ADDRESS}...`);
            if (!dryRun) {
                try {
                    const { parameters } = await (0, protocol_sdk_1.withdrawRewards)({
                        withdrawFor: config_1.CONFIG.CREATOR_ADDRESS,
                        claimSecondaryRoyalties: true,
                        account: this.account.address,
                        publicClient: this.publicClient,
                    });
                    console.log('Sending Withdraw Transaction...');
                    const withdrawHash = await this.walletClient.writeContract(parameters);
                    console.log(`Withdraw TX Hash: ${withdrawHash}`);
                    await this.publicClient.waitForTransactionReceipt({ hash: withdrawHash });
                    console.log('Withdraw confirmed.');
                }
                catch (e) {
                    console.warn(`Withdraw failed or no rewards to withdraw: ${e.message}`);
                    // Continue to swap, as we might already have balance
                }
            }
            else {
                console.log('[Dry Run] Would withdraw rewards from Zora Wallet to Privy Wallet.');
            }
            console.log({
                sellToken: config_1.CONFIG.TOKEN_ZORA,
                buyToken: config_1.CONFIG.TOKEN_LOST_MIDAS,
                sellAmount: sellAmountBigInt.toString(),
                takerAddress: this.account.address,
            });
            // 2. Get Quote
            const quoteResponse = await axios_1.default.get('https://api.0x.org/swap/allowance-holder/quote', {
                headers: {
                    '0x-api-key': config_1.CONFIG.ZERO_EX_API_KEY,
                    '0x-version': 'v2'
                },
                params: {
                    chainId: 8453,
                    sellToken: config_1.CONFIG.TOKEN_ZORA,
                    buyToken: config_1.CONFIG.TOKEN_LOST_MIDAS,
                    sellAmount: sellAmountBigInt.toString(),
                    taker: this.account.address
                }
            });
            const quote = quoteResponse.data;
            // 3. Approve Token
            const allowance = await this.publicClient.readContract({
                address: config_1.CONFIG.TOKEN_ZORA,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [this.account.address, quote.allowanceTarget]
            });
            if (allowance < sellAmountBigInt) {
                console.log('Approving 0x Router...');
                if (!dryRun) {
                    const hash = await this.walletClient.writeContract({
                        address: config_1.CONFIG.TOKEN_ZORA,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [quote.allowanceTarget, sellAmountBigInt]
                    });
                    await this.publicClient.waitForTransactionReceipt({ hash });
                    console.log('Approved.');
                }
                else {
                    console.log('[Dry Run] Would approve 0x Router.');
                }
            }
            // 4. Execute Swap
            console.log('Executing Swap...');
            let txHash = '0xDRYRUN_HASH';
            if (!dryRun) {
                txHash = await this.walletClient.sendTransaction({
                    to: quote.to,
                    data: quote.data,
                    value: BigInt(quote.value),
                });
                console.log(`Swap Sent! Hash: ${txHash}`);
                // Wait for receipt
                await this.publicClient.waitForTransactionReceipt({ hash: txHash });
            }
            else {
                console.log(`[Dry Run] Would execute swap (sending ${quote.value} wei).`);
            }
            // 5. Burn Logic
            if (config_1.CONFIG.BURN_ADDRESS) {
                const buyAmountBigInt = BigInt(quote.buyAmount);
                console.log(`Burning ${buyAmountBigInt} $LOSTMIDAS...`);
                if (!dryRun) {
                    const burnHash = await this.walletClient.writeContract({
                        address: config_1.CONFIG.TOKEN_LOST_MIDAS,
                        abi: ERC20_ABI,
                        functionName: 'transfer',
                        args: [config_1.CONFIG.BURN_ADDRESS, buyAmountBigInt]
                    });
                    console.log(`Burned! Hash: ${burnHash}`);
                }
                else {
                    console.log(`[Dry Run] Would burn ${buyAmountBigInt} $LOSTMIDAS.`);
                }
            }
            return txHash;
        }
        catch (error) {
            if (error.response) {
                console.error('Swap API Error:', error.response.data);
                console.log(error.response.data.data.details);
            }
            else {
                console.error('Swap Error:', error.message);
            }
            return null;
        }
    }
}
exports.SwapService = SwapService;
