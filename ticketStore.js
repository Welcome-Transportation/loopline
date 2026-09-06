const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'tickets.json');

async function readTicketsRaw() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    // Corrupt/partial file (e.g. a write got interrupted mid-flight under
    // load) — fall back to empty instead of crashing the server.
    console.error('tickets.json was unreadable, resetting:', err.message);
    return [];
  }
}

async function writeTicketsRaw(tickets) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tickets, null, 2));
}

// Many people can buy/check in at once during a real event. Without
// serializing access, two concurrent read-modify-write cycles can
// interleave and corrupt the file. Every read and write goes through this
// single queue so they run one at a time, in order.
let queue = Promise.resolve();

function readTickets() {
  const result = queue.then(readTicketsRaw);
  queue = result.catch(() => {});
  return result;
}

function withTickets(mutator) {
  const result = queue.then(async () => {
    const tickets = await readTicketsRaw();
    const value = await mutator(tickets);
    await writeTicketsRaw(tickets);
    return value;
  });
  queue = result.catch(() => {});
  return result;
}

module.exports = { readTickets, withTickets };
