# Nexus Chat

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/e-psungo/epsungo)

Aplicação web Node.js + Express + Socket.IO para troca de mensagens seguras em tempo real.

## Funcionalidades

- Registo independente de utilizadores
- Login com sessão
- Perfil admin com gestão de utilizadores
- Envio de mensagens de texto e imagem
- Notificações em tempo real com WebSocket
- Criptografia híbrida estilo PGP (RSA + AES-256-GCM)
- Hashes SHA-256, SHA-512 e SHA3-512
- PKI simulada com CA persistente

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação local

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Credenciais iniciais

Se ainda não existir nenhum utilizador, o sistema cria automaticamente um admin inicial:

- Utilizador: `admin`
- Palavra-passe: `admin123`

Em produção, troque estes valores usando variáveis de ambiente.

## Variáveis de ambiente

Use `.env.example` como base. As principais variáveis são:

- `PORT` porta HTTP da aplicação
- `SESSION_SECRET` segredo da sessão
- `DATA_DIR` diretório persistente para JSON, chaves da CA e uploads
- `UPLOAD_DIR` diretório dos uploads
- `ADMIN_FULL_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` utilizador admin inicial

## Persistência

Os seguintes ficheiros são gerados em tempo de execução e não devem subir para o GitHub:

- `data/nexus.json`
- `data/ca-public.pem`
- `data/ca-private.pem`
- `data/uploads/`

Por isso, a pasta `data/` está preparada para ficar fora do repositório.

## Deploy no Render

O projeto já inclui um `render.yaml` para deploy como Web Service.

Configuração prevista:

- runtime Node.js
- `npm install` no build
- `npm start` no arranque
- health check em `/health`
- disco persistente montado em `/var/data`

### Passos

1. Abra o botão "Deploy to Render" deste repositório.
2. Crie um Blueprint ou Web Service a partir de `e-psungo/epsungo`.
3. Defina `ADMIN_PASSWORD` no painel do Render.
4. Confirme o plano com disco persistente e faça o primeiro deploy.

## Estrutura

- `server.js` servidor principal
- `views/` páginas EJS
- `public/` CSS e JavaScript do frontend
- `src/config/` configuração de ambiente
- `src/services/` persistência e criptografia
- `data/` armazenamento gerado em runtime
