const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'navigator.json');

function emptyState() {
  return {
    members: [],
    alerts: [],
    busLocation: { active: false, lat: null, lng: null, updatedAt: null },
  };
}

async function readStateRaw() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    if (!raw.trim()) return emptyState();
    const state = JSON.parse(raw);
    if (!state.busLocation) state.busLocation = emptyState().busLocation;
    return state;
  } catch (err) {
    if (err.code === 'ENOENT') return emptyState();
    // Corrupt/partial file (e.g. a write got interrupted mid-flight under
    // load) — fall back to a fresh state instead of crashing the server.
    console.error('navigator.json was unreadable, resetting:', err.message);
    return emptyState();
  }
}

async function writeStateRaw(state) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

// Many phones ping this every ~20s, plus panic/join/bus-location calls can
// land at the same moment. Without serializing access, two concurrent
// read-modify-write cycles can interleave and corrupt the file (this
// crashed the server once already). Every read and write goes through this
// single queue so they run one at a time, in order.
let queue = Promise.resolve();

function readState() {
  const result = queue.then(readStateRaw);
  queue = result.catch(() => {});
  return result;
}

function withState(mutator) {
  const result = queue.then(async () => {
    const state = await readStateRaw();
    const value = await mutator(state);
    await writeStateRaw(state);
    return value;
  });
  queue = result.catch(() => {});
  return result;
}

module.exports = { readState, withState };
