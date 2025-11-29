'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

class FileTaskStore {
  constructor(filePath) {
    if (!filePath) {
      throw new Error('A file path is required to initialize FileTaskStore');
    }
    this.filePath = path.resolve(filePath);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Task file must contain an array');
      }
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      if (error.name === 'SyntaxError') {
        throw new Error(`Unable to parse tasks JSON: ${error.message}`);
      }
      throw error;
    }
  }

  async save(tasks) {
    if (!Array.isArray(tasks)) {
      throw new Error('Cannot persist tasks: expected an array');
    }
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const payload = `${JSON.stringify(tasks, null, 2)}\n`;
    await fs.writeFile(this.filePath, payload, 'utf8');
    return tasks;
  }
}

module.exports = {
  FileTaskStore
};
