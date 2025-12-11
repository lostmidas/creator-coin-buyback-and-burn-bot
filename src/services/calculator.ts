import { TIERS, PROTOCOL_FEE_BPS } from '../config';

export class TierEngine {
  
  // Calculates the Buyback Amount in USD based on volume delta and bands
  calculateBuyback(currentVolume: number, lastProcessedVolume: number): number {
    let remainingVolume = currentVolume - lastProcessedVolume;
    if (remainingVolume <= 0) return 0;

    let processedSoFar = lastProcessedVolume;
    let totalBuybackUSD = 0;

    // We only care about the "new" volume, but it must be taxed according to the band it falls into *cumulatively*.
    
    // Simplest way: Calculate Total Buyback for `currentVolume` from scratch, 
    // and subtract Total Buyback for `lastProcessedVolume`.
    // This handles all band logic automatically.
    
    const totalForCurrent = this.calculateTotalCumulativeBuyback(currentVolume);
    const totalForLast = this.calculateTotalCumulativeBuyback(lastProcessedVolume);
    
    return totalForCurrent - totalForLast;
  }

  // Helper: Calculates total buyback obligation for a given cumulative volume from 0
  private calculateTotalCumulativeBuyback(volume: number): number {
    let remaining = volume;
    let totalBuyback = 0;
    let previousMax = 0;

    for (const tier of TIERS) {
      if (remaining <= 0) break;

      const bandSize = tier.maxVolume - previousMax;
      const amountInBand = Math.min(remaining, bandSize);
      
      // Logic: Volume * Fee% * Buyback%
      // Example: $1000 * 1% * 10% = $1.00
      const feeRevenue = amountInBand * (PROTOCOL_FEE_BPS / 10000);
      const buybackAmount = feeRevenue * tier.buybackPercent;

      totalBuyback += buybackAmount;
      
      remaining -= amountInBand;
      previousMax = tier.maxVolume;
    }

    return totalBuyback;
  }
}

