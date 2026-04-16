const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mime = require('mime-types');
const { Server } = require('socket.io');
const config = require('./src/config/appConfig');
const db = require('./src/services/database');
const { ensureAuthenticated, ensureAdmin } = require('./src/middleware/auth');
const {
  generateUserIdentity,
  verifyCertificate,
  hybridEncrypt,
  hybridDecrypt,
  verifySignature,
  sha3,
  CA_KEYS
} = require('./src/services/cryptoService');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const legacyUploadDir = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, config.uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadSizeBytes },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    return cb(null, true);
  }
});

let seededDefaultAdmin = false;

if (!db.listUsers().length) {
  const identity = generateUserIdentity(config.adminDefaults.username);
  db.createUser({
    full_name: config.adminDefaults.fullName,
    username: config.adminDefaults.username,
    email: config.adminDefaults.email,
    password_hash: bcrypt.hashSync(config.adminDefaults.password, 10),
    role: 'admin',
    status: 'active',
    rsa_public_key: identity.publicKey,
    rsa_private_key: identity.privateKey,
    certificate_json: JSON.stringify(identity.certificate)
  });
  seededDefaultAdmin = true;
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  name: 'nexus.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});
app.use('/static/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/static/js', express.static(path.join(__dirname, 'public', 'js')));

app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error('Unauthorized'));
  socket.userId = Number(userId);
  return next();
});

io.on('connection', (socket) => socket.join(`user:${socket.userId}`));

function getUserById(id) {
  return db.getUserById(id);
}

function getConversation(userId, contactId) {
  const users = Object.fromEntries(db.listUsers().map((user) => [user.id, user]));

  return db.listMessages()
    .filter((message) => (
      (message.sender_id === Number(userId) && message.receiver_id === Number(contactId))
      || (message.sender_id === Number(contactId) && message.receiver_id === Number(userId))
    ))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id)
    .map((row) => {
      const currentUser = users[userId];
      const sender = users[row.sender_id];
      let preview = '[mensagem protegida]';
      let integrity = false;
      let signatureOk = false;

      try {
        const plainBuffer = hybridDecrypt(row, currentUser.rsa_private_key);
        preview = plainBuffer.toString('utf8');
        integrity = sha3(preview) === row.hash_sha3;
        signatureOk = verifySignature(Buffer.from(preview), row.signature, sender.rsa_public_key);
      } catch {}

      return {
        ...row,
        preview,
        integrity,
        signatureOk,
        sender_name: sender?.full_name || 'Desconhecido'
      };
    });
}

app.get('/', (req, res) => (req.session.user ? res.redirect('/app') : res.redirect('/login')));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  const {
    fullName, username, email, password
  } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.render('register', { error: 'Preencha todos os campos obrigatórios.' });
  }

  if (db.existsUser(username, email)) {
    return res.render('register', { error: 'Utilizador ou email já registado.' });
  }

  const identity = generateUserIdentity(username);
  db.createUser({
    full_name: fullName,
    username,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: 'user',
    status: 'active',
    rsa_public_key: identity.publicKey,
    rsa_private_key: identity.privateKey,
    certificate_json: JSON.stringify(identity.certificate)
  });
  return res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const user = db.findUserByLogin(login);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', { error: 'Credenciais inválidas.' });
  }

  if (user.status !== 'active') {
    return res.render('login', { error: 'Conta desativada pelo administrador.' });
  }

  req.session.user = {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    role: user.role
  };

  return res.redirect('/app');
});

app.post('/logout', ensureAuthenticated, (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/app', ensureAuthenticated, (req, res) => {
  const contacts = db.listUsers()
    .filter((user) => user.id !== req.session.user.id && user.status === 'active')
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const selectedId = Number(req.query.user || contacts[0]?.id || 0);
  if (selectedId) db.markConversationRead(selectedId, req.session.user.id);

  const selfUser = getUserById(req.session.user.id);

  return res.render('app', {
    contacts,
    selectedId,
    conversation: selectedId ? getConversation(req.session.user.id, selectedId) : [],
    unreadMap: db.unreadByReceiver(req.session.user.id),
    certificateOk: verifyCertificate(JSON.parse(selfUser.certificate_json)),
    cert: JSON.parse(selfUser.certificate_json),
    caPublicKey: CA_KEYS.publicKey
  });
});

app.get('/api/users', ensureAuthenticated, (req, res) => res.json(db.listUsers().map((user) => ({
  id: user.id,
  full_name: user.full_name,
  username: user.username,
  email: user.email,
  role: user.role,
  status: user.status,
  created_at: user.created_at
}))));

app.post('/api/messages', ensureAuthenticated, upload.single('image'), (req, res) => {
  const sender = getUserById(req.session.user.id);
  const receiver = getUserById(Number(req.body.receiverId));

  if (!receiver) {
    return res.status(404).json({ error: 'Destinatário não encontrado.' });
  }

  let plainPayload = req.body.message || '';
  let messageType = 'text';
  let originalName = null;
  let mimeType = 'text/plain';

  if (req.file) {
    messageType = 'image';
    originalName = req.file.originalname;
    mimeType = mime.lookup(req.file.path) || req.file.mimetype || 'application/octet-stream';
    plainPayload = JSON.stringify({
      storedName: path.basename(req.file.path),
      originalName,
      mimeType
    });
  }

  if (!plainPayload) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  const encrypted = hybridEncrypt({
    plainText: plainPayload,
    recipientPublicKey: receiver.rsa_public_key,
    senderPrivateKey: sender.rsa_private_key,
    cipherMode: req.body.cipherMode || 'pgp-rsa-aes256'
  });

  const record = db.createMessage({
    sender_id: sender.id,
    receiver_id: receiver.id,
    message_type: messageType,
    original_name: originalName,
    mime_type: mimeType,
    encrypted_content: encrypted.encryptedContent,
    encrypted_aes_key: encrypted.encryptedAesKey,
    iv: encrypted.iv,
    auth_tag: encrypted.authTag,
    signature: encrypted.signature,
    hash_sha256: encrypted.hashSha256,
    hash_sha512: encrypted.hashSha512,
    hash_sha3: encrypted.hashSha3,
    cipher_mode: encrypted.cipherMode,
    dh_public: encrypted.dhPublic,
    dh_nonce: encrypted.dhNonce
  });

  io.to(`user:${receiver.id}`).emit('new_message', {
    fromId: sender.id,
    fromName: sender.full_name,
    preview: messageType === 'text' ? plainPayload.slice(0, 80) : 'Nova imagem segura recebida',
    createdAt: record.created_at
  });

  return res.json({ ok: true, id: record.id });
});

app.get('/media/:messageId', ensureAuthenticated, (req, res) => {
  const message = db.getMessageById(req.params.messageId);

  if (!message) return res.sendStatus(404);

  if (![message.sender_id, message.receiver_id].includes(req.session.user.id) || message.message_type !== 'image') {
    return res.sendStatus(403);
  }

  try {
    const user = getUserById(req.session.user.id);
    const plain = JSON.parse(hybridDecrypt(message, user.rsa_private_key).toString('utf8'));
    const currentPath = path.join(config.uploadDir, plain.storedName);

    if (fs.existsSync(currentPath)) {
      return res.sendFile(currentPath);
    }

    const legacyPath = path.join(legacyUploadDir, plain.storedName);
    if (fs.existsSync(legacyPath)) {
      return res.sendFile(legacyPath);
    }

    return res.sendStatus(404);
  } catch {
    return res.sendStatus(500);
  }
});

app.post('/api/admin/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  const {
    full_name, username, email, password, role, status
  } = req.body;

  if (!full_name || !username || !email || !password) {
    return res.status(400).json({ error: 'Preencha os campos obrigatórios.' });
  }

  if (db.existsUser(username, email)) {
    return res.status(400).json({ error: 'Utilizador ou email já registado.' });
  }

  const identity = generateUserIdentity(username);
  const user = db.createUser({
    full_name,
    username,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: role || 'user',
    status: status || 'active',
    rsa_public_key: identity.publicKey,
    rsa_private_key: identity.privateKey,
    certificate_json: JSON.stringify(identity.certificate)
  });

  return res.json({ ok: true, id: user.id });
});

app.put('/api/admin/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  const user = db.updateUser(req.params.id, {
    full_name: req.body.full_name,
    email: req.body.email,
    role: req.body.role,
    status: req.body.status
  });

  if (!user) {
    return res.status(404).json({ error: 'Utilizador não encontrado.' });
  }

  return res.json({ ok: true });
});

app.delete('/api/admin/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  if (Number(req.params.id) === req.session.user.id) {
    return res.status(400).json({ error: 'O admin não pode remover a própria conta.' });
  }

  db.deleteUser(req.params.id);
  return res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'A imagem excede o limite de 5 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: 'Apenas imagens são permitidas.' });
  }

  console.error(err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }

  return res.status(500).send('Erro interno do servidor.');
});

server.listen(config.port, () => {
  console.log(`Nexus Chat running on port ${config.port}`);
  console.log(`Dados persistentes em: ${config.dataDir}`);

  if (!config.isProduction) {
    console.log(`Admin padrão: ${config.adminDefaults.username} / ${config.adminDefaults.password}`);
  } else if (seededDefaultAdmin) {
    console.log('Admin inicial criado a partir das variáveis de ambiente.');
  }

  if (config.isProduction && config.sessionSecret === 'nexus-super-secret-dev') {
    console.warn('SESSION_SECRET está usando o valor padrão de desenvolvimento.');
  }

  if (config.isProduction && seededDefaultAdmin && config.adminDefaults.password === 'admin123') {
    console.warn('ADMIN_PASSWORD está usando a senha padrão de desenvolvimento.');
  }
});
