# github-invite-broker

Standalone Cloudflare Worker for issuing GitHub collaborator invites through shareable links.

Each invite link is stored by SHA-256 hash of the share token and can target a different repository, expiry, claim limit, permission, and GitHub credential key. Raw GitHub tokens are stored only as Worker secrets.

## Secrets

- `ADMIN_TOKEN`: bearer token for `/admin/*`
- `APP_URL`: public base URL, `https://github-invite.fireharp.com`
- `GITHUB_TOKEN`: fallback GitHub PAT
- `GITHUB_TOKENS_JSON`: optional JSON map, e.g. `{ "client-a": "github_pat_..." }`
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
