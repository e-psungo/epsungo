const crypto = require('crypto');
const fs = require('fs');
const { dataDir, caPublicKeyFile, caPrivateKeyFile } = require('../config/appConfig');

function loadOrCreateCaKeys() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(caPublicKeyFile) && fs.existsSync(caPrivateKeyFile)) {
    return {
      publicKey: fs.readFileSync(caPublicKeyFile, 'utf8'),
      privateKey: fs.readFileSync(caPrivateKeyFile, 'utf8')
    };
  }

  const generatedKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  fs.writeFileSync(caPublicKeyFile, generatedKeys.publicKey, { encoding: 'utf8', mode: 0o644 });
  fs.writeFileSync(caPrivateKeyFile, generatedKeys.privateKey, { encoding: 'utf8', mode: 0o600 });

  return generatedKeys;
}

const CA_KEYS = loadOrCreateCaKeys();

function generateUserIdentity(username) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  const certificatePayload = {
    subject: username,
    issuer: 'Nexus Root CA',
    issuedAt: new Date().toISOString(),
    publicKey,
    serial: crypto.randomBytes(8).toString('hex')
  };

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(certificatePayload));
  signer.end();
  const signature = signer.sign(CA_KEYS.privateKey, 'base64');

  return {
    publicKey,
    privateKey,
    certificate: { ...certificatePayload, signature }
  };
}

function verifyCertificate(certificate) {
  const { signature, ...payload } = certificate;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(JSON.stringify(payload));
  verifier.end();
  return verifier.verify(CA_KEYS.publicKey, signature, 'base64');
}

function sha3(data) {
  try {
    return crypto.createHash('sha3-512').update(data).digest('hex');
  } catch {
    return crypto.createHash('sha512').update(data).digest('hex');
  }
}

function hybridEncrypt({ plainText, recipientPublicKey, senderPrivateKey, cipherMode = 'pgp-rsa-aes256' }) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const dhNonce = crypto.randomBytes(16).toString('hex');
  const dhPublic = crypto.randomBytes(16).toString('hex');

  const encryptedAesKey = crypto.publicEncrypt(recipientPublicKey, aesKey).toString('base64');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(plainText);
  signer.end();
  const signature = signer.sign(senderPrivateKey, 'base64');

  return {
    encryptedContent: encrypted.toString('base64'),
    encryptedAesKey,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    signature,
    hashSha256: crypto.createHash('sha256').update(plainText).digest('hex'),
    hashSha512: crypto.createHash('sha512').update(plainText).digest('hex'),
    hashSha3: sha3(plainText),
    cipherMode,
    dhNonce,
    dhPublic
  };
}

function hybridDecrypt(message, recipientPrivateKey) {
  const aesKey = crypto.privateDecrypt(recipientPrivateKey, Buffer.from(message.encrypted_aes_key, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(message.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(message.auth_tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(message.encrypted_content, 'base64')),
    decipher.final()
  ]);
  return decrypted;
}

function verifySignature(plainBuffer, signature, publicKey) {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(plainBuffer);
  verifier.end();
  return verifier.verify(publicKey, signature, 'base64');
}

module.exports = {
  CA_KEYS,
  generateUserIdentity,
  verifyCertificate,
  hybridEncrypt,
  hybridDecrypt,
  verifySignature,
  sha3
};
