const fs = require('fs');
const { dataDir, dataFile } = require('../config/appConfig');

fs.mkdirSync(dataDir, { recursive: true });

function ensureDb() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ counters: { users: 0, messages: 0 }, users: [], messages: [] }, null, 2));
  }
}

function load() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function save(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function nextId(type) {
  const data = load();
  data.counters[type] += 1;
  const id = data.counters[type];
  save(data);
  return id;
}

function createUser(user) {
  const data = load();
  const id = nextId('users');
  const record = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...user };
  const latest = load();
  latest.users.push(record);
  save(latest);
  return record;
}

function updateUser(id, patch) {
  const data = load();
  const index = data.users.findIndex(u => u.id === Number(id));
  if (index === -1) return null;
  data.users[index] = { ...data.users[index], ...patch, updated_at: new Date().toISOString() };
  save(data);
  return data.users[index];
}

function deleteUser(id) {
  const data = load();
  data.users = data.users.filter(u => u.id !== Number(id));
  data.messages = data.messages.filter(m => m.sender_id !== Number(id) && m.receiver_id !== Number(id));
  save(data);
}

function listUsers() { return load().users; }
function getUserById(id) { return load().users.find(u => u.id === Number(id)); }
function findUserByLogin(login) { return load().users.find(u => u.username === login || u.email === login); }
function existsUser(username, email) { return load().users.find(u => u.username === username || u.email === email); }

function createMessage(message) {
  const data = load();
  data.counters.messages += 1;
  const record = { id: data.counters.messages, created_at: new Date().toISOString(), is_read: 0, ...message };
  data.messages.push(record);
  save(data);
  return record;
}

function listMessages() { return load().messages; }
function getMessageById(id) { return load().messages.find(m => m.id === Number(id)); }
function markConversationRead(senderId, receiverId) {
  const data = load();
  data.messages = data.messages.map(m => m.sender_id === Number(senderId) && m.receiver_id === Number(receiverId) ? { ...m, is_read: 1 } : m);
  save(data);
}

function unreadByReceiver(receiverId) {
  const map = {};
  load().messages.filter(m => m.receiver_id === Number(receiverId) && !m.is_read).forEach(m => {
    map[m.sender_id] = (map[m.sender_id] || 0) + 1;
  });
  return map;
}

module.exports = {
  listUsers, getUserById, findUserByLogin, existsUser, createUser, updateUser, deleteUser,
  createMessage, listMessages, getMessageById, markConversationRead, unreadByReceiver
};
