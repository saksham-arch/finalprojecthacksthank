const crypto = require('crypto');

const deriveKey = (secret) => {
  if (!secret) {
    throw new Error('Encryption key is required to secure queue payloads.');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const encrypt = (plainText, secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    content: encrypted.toString('base64')
  };
};

const decrypt = (payload, secret) => {
  if (!payload || !payload.iv) {
    return '';
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
};

module.exports = {
  encrypt,
  decrypt
};
