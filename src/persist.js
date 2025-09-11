import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_FILE = path.join(process.cwd(), '.notex.json');
const GLOBAL_FILE = path.join(os.homedir ? os.homedir() : process.env.HOME || '', '.notex-global.json');

export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function loadTasks(filePath = DEFAULT_FILE) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const data = JSON.parse(raw);
    let tasks = [];
    if (Array.isArray(data)) tasks = data;
    else if (data && Array.isArray(data.tasks)) tasks = data.tasks;
    else tasks = [];
    // Coerce/upgrade tasks to include timestamps
    const now = Date.now();
    return tasks.map(t => ({
      id: typeof t.id === 'number' || typeof t.id === 'string' ? t.id : now,
      text: String(t.text || ''),
      done: Boolean(t.done),
      createdAt: t.createdAt || now,
      completedAt: t.done ? (t.completedAt || now) : null
    }));
  } catch (err) {
    return [];
  }
}

export function saveTasks(tasks, filePath = DEFAULT_FILE) {
  try {
    const payload = JSON.stringify({ tasks }, null, 2);
    fs.writeFileSync(filePath, payload);
    return true;
  } catch (err) {
    return false;
  }
}
export { DEFAULT_FILE, GLOBAL_FILE };
