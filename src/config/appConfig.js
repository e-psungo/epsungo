const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

function resolveConfigPath(envValue, fallbackPath) {
  if (!envValue) return fallbackPath;
  return path.isAbsolute(envValue) ? envValue : path.join(rootDir, envValue);
}

function resolvePositiveInteger(envValue, fallbackValue) {
  const parsed = Number.parseInt(envValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const dataDir = resolveConfigPath(process.env.DATA_DIR, path.join(rootDir, 'data'));

module.exports = {
  rootDir,
  port: resolvePositiveInteger(process.env.PORT, 3000),
  isProduction: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'nexus-super-secret-dev',
  maxUploadSizeBytes: resolvePositiveInteger(process.env.MAX_UPLOAD_SIZE_BYTES, 5 * 1024 * 1024),
  dataDir,
  dataFile: resolveConfigPath(process.env.DATA_FILE, path.join(dataDir, 'nexus.json')),
  uploadDir: resolveConfigPath(process.env.UPLOAD_DIR, path.join(dataDir, 'uploads')),
  caPublicKeyFile: resolveConfigPath(process.env.CA_PUBLIC_KEY_FILE, path.join(dataDir, 'ca-public.pem')),
  caPrivateKeyFile: resolveConfigPath(process.env.CA_PRIVATE_KEY_FILE, path.join(dataDir, 'ca-private.pem')),
  adminDefaults: {
    fullName: process.env.ADMIN_FULL_NAME || 'Administrador Nexus',
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@nexus.local',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  }
};
