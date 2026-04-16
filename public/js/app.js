(function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('nexus-theme');
  const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  root.setAttribute('data-bs-theme', preferred);
})();

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-bs-theme', next);
    localStorage.setItem('nexus-theme', next);
  });
}

const hasSocket = typeof io !== 'undefined' && window.NEXUS?.userId;
const socket = hasSocket ? io({ auth: { userId: window.NEXUS.userId } }) : null;
const form = document.getElementById('messageForm');
const chatBody = document.getElementById('chatBody');
const createUserForm = document.getElementById('createUserForm');

if (chatBody) {
  chatBody.scrollTop = chatBody.scrollHeight;
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

if (socket) {
  socket.on('new_message', (payload) => {
    const currentUrl = new URL(window.location.href);
    const activeUser = Number(currentUrl.searchParams.get('user') || 0);
    if (Notification.permission === 'granted') {
      new Notification(`Nova mensagem de ${payload.fromName}`, { body: payload.preview });
    }
    if (activeUser === payload.fromId) {
      window.location.reload();
      return;
    }
    window.location.reload();
  });
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const response = await fetch('/api/messages', { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Falha ao enviar.');
      return;
    }
    form.reset();
    window.location.reload();
  });
}

async function loadAdminUsers() {
  if (!window.NEXUS?.isAdmin) return;
  const host = document.getElementById('adminUsersTable');
  if (!host) return;
  const users = await fetch('/api/users').then(r => r.json());
  host.innerHTML = `
    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Utilizador</th>
            <th>Email</th>
            <th>Perfil</th>
            <th>Estado</th>
            <th class="text-end">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.id}</td>
              <td><input class="form-control form-control-sm" data-field="full_name" data-id="${u.id}" value="${u.full_name}"></td>
              <td>${u.username}</td>
              <td><input class="form-control form-control-sm" data-field="email" data-id="${u.id}" value="${u.email}"></td>
              <td>
                <select class="form-select form-select-sm" data-field="role" data-id="${u.id}">
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              </td>
              <td>
                <select class="form-select form-select-sm" data-field="status" data-id="${u.id}">
                  <option value="active" ${u.status === 'active' ? 'selected' : ''}>active</option>
                  <option value="disabled" ${u.status === 'disabled' ? 'selected' : ''}>disabled</option>
                </select>
              </td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-primary" onclick="saveUser(${u.id})">Guardar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})">Apagar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

window.saveUser = async (id) => {
  const getValue = (field) => document.querySelector(`[data-field="${field}"][data-id="${id}"]`)?.value;
  const payload = {
    full_name: getValue('full_name'),
    email: getValue('email'),
    role: getValue('role'),
    status: getValue('status')
  };
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!response.ok) return alert('Falha ao atualizar utilizador.');
  alert('Utilizador atualizado com sucesso.');
};

window.deleteUser = async (id) => {
  if (!confirm('Deseja realmente remover este utilizador?')) return;
  const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  const result = await response.json();
  if (!response.ok) return alert(result.error || 'Falha ao remover.');
  await loadAdminUsers();
};

if (createUserForm) {
  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(createUserForm).entries());
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'Falha ao criar utilizador.');
      return;
    }
    createUserForm.reset();
    await loadAdminUsers();
    alert('Utilizador criado com sucesso.');
  });
}

document.getElementById('adminModal')?.addEventListener('show.bs.modal', loadAdminUsers);
