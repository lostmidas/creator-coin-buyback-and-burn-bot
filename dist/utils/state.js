"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveState = exports.loadState = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const STATE_FILE = path_1.default.join(process.cwd(), 'data', 'state.json');
const loadState = async () => {
    try {
        if (await fs_extra_1.default.pathExists(STATE_FILE)) {
            return await fs_extra_1.default.readJSON(STATE_FILE);
        }
    }
    catch (error) {
        console.error('Error reading state file:', error);
    }
    return { coins: {}, lastRunTimestamp: 0 };
};
exports.loadState = loadState;
const saveState = async (state) => {
    try {
        await fs_extra_1.default.ensureDir(path_1.default.dirname(STATE_FILE));
        await fs_extra_1.default.writeJSON(STATE_FILE, state, { spaces: 2 });
    }
    catch (error) {
        console.error('Error saving state file:', error);
    }
};
exports.saveState = saveState;
