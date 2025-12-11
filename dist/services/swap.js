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
    }
    async executeSwap(amountInETH, dryRun = false) {
        try {
            // Step 1: Get $ZORA Price
            const priceResponse = await axios_1.default.get('https://base.api.0x.org/swap/v1/price', {
                headers: { '0x-api-key': config_1.CONFIG.ZERO_EX_API_KEY },
                params: {
                    sellToken: config_1.CONFIG.TOKEN_ZORA,
                    buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
                    sellAmount: (0, viem_1.parseUnits)('1', 18).toString()
                }
            });
            const zoraPriceUSD = parseFloat(priceResponse.data.price);
            if (!zoraPriceUSD || zoraPriceUSD === 0) {
                console.error('Failed to fetch ZORA price');
                return null;
            }
            const zoraAmountToSell = (amountInETH / zoraPriceUSD);
            const sellAmountBigInt = (0, viem_1.parseUnits)(zoraAmountToSell.toFixed(18), 18);
            console.log(`Swap: Selling ${zoraAmountToSell} $ZORA ($${amountInETH} USD) for $LOSTMIDAS`);
            // 2. Get Quote
            const quoteResponse = await axios_1.default.get('https://base.api.0x.org/swap/v1/quote', {
                headers: { '0x-api-key': config_1.CONFIG.ZERO_EX_API_KEY },
                params: {
                    sellToken: config_1.CONFIG.TOKEN_ZORA,
                    buyToken: config_1.CONFIG.TOKEN_LOST_MIDAS,
                    sellAmount: sellAmountBigInt.toString(),
                    takerAddress: this.account.address
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
            }
            else {
                console.error('Swap Error:', error.message);
            }
            return null;
        }
    }
}
exports.SwapService = SwapService;
