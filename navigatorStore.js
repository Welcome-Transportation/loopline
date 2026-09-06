const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'navigator.json');

const EMPTY_STATE = { members: [], alerts: [] };

async function readState() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { ...EMPTY_STATE };
    throw err;
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

module.exports = { readState, writeState };
