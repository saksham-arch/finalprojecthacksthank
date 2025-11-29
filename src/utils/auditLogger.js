const fs = require('fs');
const path = require('path');

class AuditLogger {
  constructor(filePath = path.join(process.cwd(), 'audit_log.jsonl')) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8');
    }
  }

  async write(event) {
    const entry = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
    await fs.promises.appendFile(this.filePath, `${entry}\n`, 'utf8');
  }
}

module.exports = { AuditLogger };
