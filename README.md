# Nexus Chat

Aplicacao web Node.js + Express + Socket.IO para troca de mensagens seguras em tempo real.

## Funcionalidades

- Registo independente de utilizadores
- Login com sessao
- Perfil admin com gestao de utilizadores
- Envio de mensagens de texto e imagem
- Notificacoes em tempo real com WebSocket
- Criptografia hibrida estilo PGP (RSA + AES-256-GCM)
- Hashes SHA-256, SHA-512 e SHA3-512
- PKI simulada com CA persistente

## Requisitos

- Node.js 20 ou superior
- npm

## Instalacao local

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Credenciais iniciais

Se ainda nao existir nenhum utilizador, o sistema cria automaticamente um admin inicial:

- Utilizador: `admin`
- Palavra-passe: `admin123`

Em producao, troque estes valores usando variaveis de ambiente.

## Variaveis de ambiente

Use `.env.example` como base. As principais variaveis sao:

- `PORT` porta HTTP da aplicacao
- `SESSION_SECRET` segredo da sessao
- `DATA_DIR` diretorio persistente para JSON, chaves da CA e uploads
- `UPLOAD_DIR` diretorio dos uploads
- `ADMIN_FULL_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` utilizador admin inicial

## Persistencia

Os seguintes ficheiros sao gerados em tempo de execucao e nao devem subir para o GitHub:

- `data/nexus.json`
- `data/ca-public.pem`
- `data/ca-private.pem`
- `data/uploads/`

Por isso, a pasta `data/` esta preparada para ficar fora do repositorio.

## Deploy no cPanel

Este projeto foi ajustado para o fluxo padrao do cPanel Application Manager e Passenger.

### O que ja esta preparado

- `app.js` existe como startup file padrao do cPanel.
- `server.js` continua com a logica principal da app.
- `tmp/.gitignore` existe para permitir o restart via `tmp/restart.txt`.
- `.cpanel.yml.example` foi incluido como base para deploy por Git no cPanel.

### Passos recomendados para `epsungo.com`

1. No cPanel, confirme que o servidor tem `Application Manager` e um pacote Node.js instalado.
2. Em `Application Manager`, crie uma aplicacao Node.js para o dominio `epsungo.com`.
3. Use um `Application Root` fora de `public_html`, por exemplo `nodeapps/nexus-chat`.
4. Defina o startup file como `app.js`.
5. Aponte a aplicacao para a raiz do dominio ou para o caminho desejado em `epsungo.com`.
6. No Terminal do cPanel, dentro da pasta da app, execute `npm install --omit=dev`.
7. Configure as variaveis de ambiente da app:
   - `NODE_ENV=production`
   - `SESSION_SECRET=<valor forte>`
   - `DATA_DIR=/home/SEU_USUARIO/nodeapps/nexus-chat/data`
   - `UPLOAD_DIR=/home/SEU_USUARIO/nodeapps/nexus-chat/data/uploads`
   - `ADMIN_FULL_NAME=Administrador Nexus`
   - `ADMIN_USERNAME=admin`
   - `ADMIN_EMAIL=admin@epsungo.com`
   - `ADMIN_PASSWORD=<senha forte>`
8. Reinicie a app no cPanel ou execute `npm run cpanel:restart`.

### Deploy por Git no cPanel

Se for usar `Git Version Control` do cPanel:

1. Clone ou crie o repositorio no cPanel.
2. Copie `.cpanel.yml.example` para `.cpanel.yml` e ajuste `APPPATH`.
3. Faca o deploy pelo fluxo de `Pull or Deploy` do cPanel.

### Notas

- O cPanel procura `app.js` por defeito. Por isso esse ficheiro foi adicionado.
- Se alterar codigo e a app nao reiniciar sozinha, toque `tmp/restart.txt`.
- Para esta app, nao use armazenamento efemero para `data/`.

## Estrutura

- `app.js` entry point para cPanel/Passenger
- `server.js` servidor principal
- `views/` paginas EJS
- `public/` CSS e JavaScript do frontend
- `src/config/` configuracao de ambiente
- `src/services/` persistencia e criptografia
- `data/` armazenamento gerado em runtime
