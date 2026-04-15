# Deploy Webhook

This repo can run a small GitHub push webhook listener on the Linux server. The listener verifies GitHub's HMAC signature, pulls `main`, checks changed paths, runs validation, builds, and restarts only the affected PM2 processes.

## Server Target

The planned server is `129.150.54.165`. Keep the Node listener bound to `127.0.0.1` and expose it through nginx over HTTPS.

## PM2 Processes

The application processes come from the root `ecosystem.config.js`:

- `backend`
- `backend-cron`
- `tipti-bot`

The deploy listener should be a separate PM2 process named `deploy-webhook`.

## Environment

Create a real deploy env file on the server using `scripts/deploy.env.example` as the template. Do not commit real secrets.

Required:

- `WEBHOOK_SECRET`
- `REPO_DIR`
- `PORT`

Defaults:

- `HOST=127.0.0.1`
- `REMOTE_NAME=origin`
- `DEPLOY_BRANCH=main`
- `BACKEND_PM2_PROCESSES=backend,backend-cron`
- `BOT_PM2_PROCESS=tipti-bot`

## Start Listener

From the repo directory on the server:

```bash
set -a
. ./scripts/deploy.env
set +a
pm2 start scripts/webhook-deploy.js --name deploy-webhook --interpreter node
pm2 save
```

## nginx Proxy

Use your actual domain and webhook path when configuring GitHub. A typical nginx location looks like this:

```nginx
location /deploy/payload {
  proxy_pass http://127.0.0.1:<deploy-port>/payload;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

After changing nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## GitHub Webhook

In the GitHub repository settings, add a webhook:

- Payload URL: the HTTPS URL that nginx exposes
- Content type: `application/json`
- Secret: same value as `WEBHOOK_SECRET`
- Events: push events

## Deploy Behavior

For backend changes:

1. Run `npm install` if `backend/package.json` changed.
2. Run `npm test -- --run`.
3. Run `npm run build`.
4. Restart `backend` and `backend-cron`.

For `tipti-clanker` changes:

1. Run `npm install` if `tipti-clanker/package.json` changed.
2. Run `npm run build`.
3. Restart `tipti-bot`.

The server worktree must have no tracked local changes. If it does, deployment stops before pulling or restarting.

## Troubleshooting

```bash
pm2 status
pm2 logs deploy-webhook
pm2 logs backend
pm2 logs backend-cron
pm2 logs tipti-bot
```
