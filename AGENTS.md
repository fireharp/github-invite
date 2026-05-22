# GitHub Invite Broker Agent Guide

Be brief. Do the operation end to end when credentials are available.

## Safety

- Never print or commit `ADMIN_TOKEN`, GitHub PATs, `GITHUB_TOKENS_JSON`, or generated invite tokens except when the user explicitly needs the final share URL.
- Do not commit concrete deployment hostnames, target repository names, email addresses, Cloudflare account/resource IDs, or dated invite examples into README/runbook prose; use placeholders or environment variables.
- Do not remove existing collaborator access unless the user explicitly asks for access removal. Revoking an invite only stops future claims.
- Run `pnpm type-check && pnpm test` before deploys.

## Common Operations

- Deploy or redeploy: `pnpm run deploy`.
- Deployment requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_NAME`, `INVITE_KV_NAMESPACE_ID`, and `WORKER_HOSTNAME`; `pnpm build:config` generates ignored `wrangler.generated.jsonc`.
- Create an invite: POST `/admin/invite` with `Authorization: Bearer $ADMIN_TOKEN`.
- Revoke a link: POST `/admin/revoke` with the original share token.
- Remove collaborator access: use GitHub API `DELETE /repos/{owner}/{repo}/collaborators/{username}` after explicit user request.
- Rotate or add GitHub credentials: update `GITHUB_TOKEN` or `GITHUB_TOKENS_JSON` with `pnpm wrangler secret put`.

## Implementation Notes

- Invite records live in KV under `invite:${sha256(token)}`.
- Claim counts live in Durable Object instances named by the same token hash.
- `githubTokenKey` selects a token from `GITHUB_TOKENS_JSON`; `null` falls back to `GITHUB_TOKEN`.
- User-owned repos should set `omitPermission: true`; GitHub only accepts explicit collaborator permissions on org repos.
- The public form is served from `/`, and admin endpoints are under `/admin/*`.
