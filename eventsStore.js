const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'events.json');

async function readEventsRaw() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('events.json was unreadable, resetting:', err.message);
    return [];
  }
}

async function writeEventsRaw(events) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(events, null, 2));
}

// Admin can edit this file by hand, but activating a crowdfunded proposal
// also writes to it programmatically — serialize access like the other
// stores so the two can't race and corrupt the file.
let queue = Promise.resolve();

function readEvents() {
  const result = queue.then(readEventsRaw);
  queue = result.catch(() => {});
  return result;
}

function withEvents(mutator) {
  const result = queue.then(async () => {
    const events = await readEventsRaw();
    const value = await mutator(events);
    await writeEventsRaw(events);
    return value;
  });
  queue = result.catch(() => {});
  return result;
}

async function readUpcomingEvents() {
  const events = await readEvents();
  const today = new Date().toISOString().slice(0, 10);
  // A crowdfunded event that's been activated but doesn't have a date set
  // yet (date: null, "TBD") still belongs on the calendar. A proposal still
  // gathering pledges has no date either, and stays visible until someone
  // cancels it.
  return events
    .filter((e) => e.status !== 'cancelled')
    .filter((e) => e.date == null || e.date >= today)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

async function findEventById(id) {
  const events = await readEvents();
  return events.find((e) => e.id === id) || null;
}

module.exports = { readEvents, withEvents, readUpcomingEvents, findEventById };
