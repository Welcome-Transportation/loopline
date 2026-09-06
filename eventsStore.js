const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'events.json');

async function readEvents() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function readUpcomingEvents() {
  const events = await readEvents();
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

async function findEventById(id) {
  const events = await readEvents();
  return events.find((e) => e.id === id) || null;
}

module.exports = { readEvents, readUpcomingEvents, findEventById };
