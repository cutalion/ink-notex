import fs from 'fs';
import path from 'path';

const DEFAULT_FILE = path.join(process.cwd(), '.notex.json');

export function loadTasks(filePath = DEFAULT_FILE) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tasks)) return data.tasks;
    return [];
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
export { DEFAULT_FILE };
