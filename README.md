# github-invite-broker

Standalone Cloudflare Worker for issuing GitHub collaborator invites through shareable links.

Each invite link is stored by SHA-256 hash of the share token and can target a different repository, expiry, claim limit, permission, and GitHub credential key. Raw GitHub tokens are stored only as Worker secrets.

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for agent-friendly create, revoke, access removal, deploy, redeploy, and troubleshooting runbooks.

## Secrets

- `ADMIN_TOKEN`: bearer token for `/admin/*`
- `APP_URL`: public base URL, `https://github-invite.fireharp.com`
- `GITHUB_TOKEN`: fallback GitHub PAT
- `GITHUB_TOKENS_JSON`: optional JSON map, e.g. `{ "client-a": "<github-token>" }`
- `RESEND_API_KEY`: optional Resend API key
- `RESEND_FROM_EMAIL`: optional verified sender
- `ALERT_TO_EMAIL`: optional alert recipient

## Commands

```bash
pnpm install
pnpm type-check
pnpm test
pnpm run deploy
```

## Create an invite

```bash
TOKEN=$(openssl rand -hex 16)
curl -X POST https://github-invite.fireharp.com/admin/invite \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$TOKEN"'",
    "repoOwner": "fireharp",
    "repoName": "better-stack-assignment",
    "maxClaims": 0,
    "expiresAt": "2026-06-01T00:00:00Z",
    "omitPermission": true
  }'
```

The response includes the share URL.

## Revoke an invite

```bash
curl -X POST https://github-invite.fireharp.com/admin/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"<original-share-token>"}'
```

Revoking an invite stops future claims. It does not remove collaborators who already accepted access.

## Theme

The public form defaults to system color scheme. Visitors can switch System, Light, or Dark; the choice is persisted in `localStorage` under `github-invite-theme`.
