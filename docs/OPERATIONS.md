# Operations

This Worker serves shareable GitHub collaborator invite links at `https://github-invite.fireharp.com`.

## Agent Prompts

Use these prompt shapes when asking an agent to operate the service:

- "Create an invite for `owner/repo`, expiring at `<ISO date>`, max claims `<N>`, using token key `<key or fallback>`."
- "Revoke this invite link: `<url>`."
- "Remove GitHub collaborator `username` from `owner/repo`."
- "Redeploy github-invite-broker and verify the live invite form."
- "Rotate the GitHub token key `<key>` and test that existing fallback-token invites still work."

## Create Invite

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
    "omitPermission": true,
    "githubTokenKey": null
  }'
```

The response returns the share URL. Do not commit generated tokens.

## Revoke Invite Link

```bash
curl -X POST https://github-invite.fireharp.com/admin/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"<original-share-token>"}'
```

Revocation prevents future use of the link. It does not remove people who already accepted access.

## Remove Repository Access

Only do this after an explicit request naming the user and repo:

```bash
gh api -X DELETE repos/OWNER/REPO/collaborators/USERNAME
```

## Credentials

Fallback token:

```bash
pnpm wrangler secret put GITHUB_TOKEN
```

Named tokens:

```bash
pnpm wrangler secret put GITHUB_TOKENS_JSON
```

Example value shape:

```json
{
  "client-a": "<github-token>",
  "client-b": "<github-token>"
}
```

For org-owned repositories, use `permission` with one of `pull`, `triage`, `push`, `maintain`, or `admin`. For user-owned repositories, set `omitPermission: true`.

## Deploy

```bash
pnpm install
pnpm type-check
pnpm test
pnpm run deploy
```

Verify:

```bash
curl -I https://github-invite.fireharp.com/
curl -sS 'https://github-invite.fireharp.com/?token=<token>' | rg 'Private Repo Invite|GitHub username|Send invite'
```

## Troubleshooting

- `DNS_PROBE_FINISHED_NXDOMAIN`: check public DNS with `dig @1.1.1.1 github-invite.fireharp.com`; local resolvers may cache NXDOMAIN for the SOA negative TTL.
- `401 Unauthorized`: missing or wrong `ADMIN_TOKEN`.
- `Server token lacks permission`: rotate the selected GitHub PAT and ensure it has collaborator administration access for the target repo.
- `GitHub invite rate limit reached`: GitHub collaborator invites are rate limited; retry later or use a different authorized token if appropriate.
