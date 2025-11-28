const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('../lib/encryption');
const { ensureDir } = require('../lib/fs-utils');

class MessageQueue {
  constructor({ filePath, encryptionKey }) {
    this.filePath = filePath;
    this.encryptionKey = encryptionKey;
    this.entries = [];
    this.loaded = false;
  }

  async load() {
    if (this.loaded) {
      return;
    }

    await ensureDir(path.dirname(this.filePath));

    if (!fs.existsSync(this.filePath)) {
      await this._persist();
      this.loaded = true;
      return;
    }

    const raw = await fs.promises.readFile(this.filePath, 'utf8');
    if (!raw || !raw.trim()) {
      this.entries = [];
      this.loaded = true;
      return;
    }

    try {
      const payload = JSON.parse(raw);
      const decrypted = decrypt(payload, this.encryptionKey) || '[]';
      this.entries = JSON.parse(decrypted);
    } catch (error) {
      // If decryption fails, keep queue empty but do not overwrite file.
      this.entries = [];
    }
    this.loaded = true;
  }

  async _persist() {
    await ensureDir(path.dirname(this.filePath));
    const encrypted = encrypt(JSON.stringify(this.entries), this.encryptionKey);
    await fs.promises.writeFile(this.filePath, JSON.stringify(encrypted), 'utf8');
  }

  async enqueue(entry) {
    await this.load();
    this.entries.push(entry);
    await this._persist();
    return entry;
  }

  async list() {
    await this.load();
    return this.entries.map((entry) => ({ ...entry }));
  }

  async getEntry(entryId) {
    await this.load();
    const entry = this.entries.find((item) => item.id === entryId);
    return entry ? { ...entry } : null;
  }

  async updateEntry(entryId, updates) {
    await this.load();
    const index = this.entries.findIndex((item) => item.id === entryId);
    if (index === -1) {
      return null;
    }
    const updated = {
      ...this.entries[index],
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    this.entries[index] = updated;
    await this._persist();
    return { ...updated };
  }

  async getDueEntries(now = Date.now()) {
    await this.load();
    return this.entries
      .filter((entry) => {
        if (!entry.nextAttemptAt) {
          return entry.status === 'queued';
        }
        return entry.nextAttemptAt <= now;
      })
      .filter((entry) => ['queued', 'retry_scheduled', 'offline_pending'].includes(entry.status));
  }

  async replaceAll(entries) {
    this.entries = entries.map((entry) => ({ ...entry }));
    this.loaded = true;
    await this._persist();
  }
}

module.exports = MessageQueue;
