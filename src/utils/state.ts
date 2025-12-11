import fs from 'fs-extra';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'data', 'state.json');

export interface CoinState {
  cumulativeVolumeUSD: number;
  lastProcessedVolumeUSD: number;
  totalBuybackETH: number; // Tracking in ETH/ZORA value terms
}

export interface AppState {
  coins: Record<string, CoinState>; // Keyed by Coin Contract Address
  lastRunTimestamp: number;
}

export const loadState = async (): Promise<AppState> => {
  try {
    if (await fs.pathExists(STATE_FILE)) {
      return await fs.readJSON(STATE_FILE);
    }
  } catch (error) {
    console.error('Error reading state file:', error);
  }
  return { coins: {}, lastRunTimestamp: 0 };
};

export const saveState = async (state: AppState) => {
  try {
    await fs.ensureDir(path.dirname(STATE_FILE));
    await fs.writeJSON(STATE_FILE, state, { spaces: 2 });
  } catch (error) {
    console.error('Error saving state file:', error);
  }
};

