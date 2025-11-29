'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FileTaskStore } = require('../src/core/task-store');

describe('FileTaskStore', () => {
  test('returns an empty array when the file does not exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-store-'));
    const filePath = path.join(dir, 'missing.json');
    const store = new FileTaskStore(filePath);
    const tasks = await store.load();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks).toHaveLength(0);
  });

  test('persists and reloads tasks', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-store-'));
    const filePath = path.join(dir, 'tasks.json');
    const store = new FileTaskStore(filePath);
    const sample = [{ id: 'TASK-X', title: 'Hello' }];
    await store.save(sample);
    const reloaded = await store.load();
    expect(reloaded).toEqual(sample);
  });
});
