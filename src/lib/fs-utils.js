const fs = require('fs');

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

module.exports = {
  ensureDir
};
