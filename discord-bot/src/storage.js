import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
fs.mkdirSync(dir, { recursive: true });

function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  } catch {
    return fallback;
  }
}
function save(name, data) {
  const file = path.join(dir, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

const guilds = load('guilds.json', {});
export const getGuild = (id) => guilds[id] ?? {};
export function setGuild(id, patch) {
  guilds[id] = { ...getGuild(id), ...patch };
  save('guilds.json', guilds);
  return guilds[id];
}

let reminders = load('reminders.json', []);
export const listReminders = () => reminders;
export function addReminder(r) {
  reminders.push(r);
  save('reminders.json', reminders);
}
export function removeReminder(id) {
  reminders = reminders.filter((r) => r.id !== id);
  save('reminders.json', reminders);
}
