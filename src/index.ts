// Helpers

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// UI

const ADMIN_BASE_PATH = "/admin";

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    color-scheme: light;
    --bg: #f6f8fa;
    --card: #ffffff;
    --border: #d0d7de;
    --text: #24292f;
    --muted: #57606a;
    --field: #ffffff;
    --focus: #0969da;
    --button: #1f883d;
    --button-hover: #1a7f37;
    --error-bg: #ffebe9;
    --error-border: #cf222e;
    --error-text: #a40e26;
    --shadow: 0 24px 80px rgba(31, 35, 40, 0.12);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --field: #0d1117;
      --focus: #388bfd;
      --button: #238636;
      --button-hover: #2ea043;
      --error-bg: #3d1f1f;
      --error-border: #f85149;
      --error-text: #f85149;
      --shadow: 0 24px 80px rgba(1, 4, 9, 0.42);
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0d1117;
    --card: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --field: #0d1117;
    --focus: #388bfd;
    --button: #238636;
    --button-hover: #2ea043;
    --error-bg: #3d1f1f;
    --error-border: #f85149;
    --error-text: #f85149;
    --shadow: 0 24px 80px rgba(1, 4, 9, 0.42);
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg); color: var(--text);
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 20px;
  }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 32px; max-width: 420px; width: 100%; box-shadow: var(--shadow); }
  h1 { font-size: 1.25rem; margin: 0 0 8px; letter-spacing: 0; }
  p  { color: var(--muted); font-size: 0.9rem; margin: 0 0 20px; }
  .repo {
    display: inline-flex; align-items: center; max-width: 100%; margin: 0 0 18px;
    padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px;
    color: var(--text); background: var(--field); font: 0.86rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    overflow-wrap: anywhere;
  }
  input {
    width: 100%; padding: 10px 12px; font-size: 1rem;
    background: var(--field); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    margin-bottom: 12px; outline: none;
  }
  input:focus { border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 22%, transparent); }
  form button {
    display: block; width: 100%; padding: 10px; font-size: 1rem; font-weight: 600;
    background: var(--button); color: #fff; border: none; border-radius: 6px; cursor: pointer;
  }
  form button:hover { background: var(--button-hover); }
  .msg { padding: 10px 12px; border-radius: 6px; font-size: 0.9rem; margin-bottom: 16px; }
  .error { background: var(--error-bg); border: 1px solid var(--error-border); color: var(--error-text); }
  .theme-switch {
    position: fixed; top: 16px; right: 16px; display: flex; gap: 4px;
    background: color-mix(in srgb, var(--card) 86%, transparent);
    border: 1px solid var(--border); border-radius: 8px; padding: 4px;
    box-shadow: 0 8px 32px rgba(31, 35, 40, 0.12);
  }
  .theme-switch button {
    border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer;
    background: transparent; color: var(--muted); font: inherit; font-size: 0.78rem;
  }
  .theme-switch button[aria-pressed="true"] { background: var(--text); color: var(--card); }
  @media (max-width: 520px) {
    body { align-items: flex-start; padding-top: 72px; }
    .theme-switch { left: 16px; right: auto; }
    .card { padding: 24px; }
  }
`;

const THEME_BOOT = `
  (function() {
    try {
      var key = "github-invite-theme";
      var stored = localStorage.getItem(key);
      var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      document.documentElement.dataset.theme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "system";
    }
  })();
`;

const THEME_CONTROLS = `
  <div class="theme-switch" role="group" aria-label="Color theme">
    <button type="button" data-theme-option="system" aria-pressed="true">System</button>
    <button type="button" data-theme-option="light" aria-pressed="false">Light</button>
    <button type="button" data-theme-option="dark" aria-pressed="false">Dark</button>
  </div>
`;

const THEME_SCRIPT = `
  (function() {
    var key = "github-invite-theme";
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-theme-option]"));
    function normalize(theme) {
      return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
    }
    function apply(theme, persist) {
      theme = normalize(theme);
      document.documentElement.dataset.theme = theme;
      buttons.forEach(function(button) {
        button.setAttribute("aria-pressed", button.dataset.themeOption === theme ? "true" : "false");
      });
      if (persist) {
        try { localStorage.setItem(key, theme); } catch (_) {}
      }
    }
    buttons.forEach(function(button) {
      button.addEventListener("click", function() {
        apply(button.dataset.themeOption, true);
      });
    });
    var current = "system";
    try { current = localStorage.getItem(key) || "system"; } catch (_) {}
    apply(current, false);
  })();
`;

const wrap = (inner: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>GitHub Repo Invite</title><script>${THEME_BOOT}</script><style>${STYLES}</style></head>
<body>${THEME_CONTROLS}<div class="card">${inner}</div><script>${THEME_SCRIPT}</script></body></html>`;

function repoLabel(inv: Pick<InviteRecord, "repoOwner" | "repoName">): string {
  return `${inv.repoOwner}/${inv.repoName}`;
}

const formPage = (token: string, inv: InviteRecord, error?: string) => wrap(`
  <h1>Private Repo Invite</h1>
  <p>Enter your GitHub username to receive a collaborator invite to:</p>
  <div class="repo">${esc(repoLabel(inv))}</div>
  ${error ? `<div class="msg error">${esc(error)}</div>` : ""}
  <form method="POST" action="/">
    <input type="hidden" name="token" value="${esc(token)}">
    <input type="text" name="username" placeholder="GitHub username" required
           autocomplete="off" spellcheck="false" autocapitalize="none">
    <button type="submit">Send invite</button>
  </form>
`);

const successPage = (login: string, inv: InviteRecord) => wrap(`
  <h1>Invite sent</h1>
  <p>Check your GitHub notifications to accept the collaborator invite for <strong>@${esc(login)}</strong>.</p>
  <div class="repo">${esc(repoLabel(inv))}</div>
`);

const errorPage = (msg: string) => wrap(`
  <h1>Something went wrong</h1>
  <div class="msg error">${esc(msg)}</div>
`);

function htmlResp(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function isInvitePath(pathname: string): boolean {
  return pathname === "/";
}

// Types

type Permission = "pull" | "triage" | "push" | "maintain" | "admin";

export interface InviteRecord {
  repoOwner: string;
  repoName: string;
  permission: Permission;
  omitPermission: boolean;
  maxClaims: number;
  expiresAt: string | null;
  revokedAt: string | null;
  githubTokenKey: string | null;
}

interface InviteInput {
  token: string;
  repoOwner?: string;
  repoName?: string;
  permission?: Permission;
  omitPermission?: boolean;
  maxClaims?: number;
  expiresAt?: string | null;
  githubTokenKey?: string | null;
}

export interface Env {
  INVITE_KV: KVNamespace;
  INVITE_CLAIMS: DurableObjectNamespace;
  GITHUB_TOKEN?: string;
  GITHUB_TOKENS_JSON?: string;
  APP_URL: string;
  ADMIN_TOKEN: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ALERT_TO_EMAIL?: string;
}

// Durable Object: atomic per-invite claim counter

export class InviteClaims implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = await request.json<{ username: string; maxClaims?: number }>();
    const username = body.username.toLowerCase();

    if (url.pathname === "/unclaim") {
      await this.state.storage.transaction(async (txn) => {
        const userKey = `user:${username}`;
        const existed = await txn.get(userKey);
        if (!existed) return;
        const count: number = (await txn.get("count")) ?? 0;
        await txn.delete(userKey);
        await txn.put("count", Math.max(0, count - 1));
      });
      return Response.json({ ok: true });
    }

    return this.state.storage.transaction(async (txn) => {
      const maxClaims = body.maxClaims ?? 0;
      const count: number = (await txn.get("count")) ?? 0;
      if (maxClaims > 0 && count >= maxClaims) {
        return Response.json({ ok: false, reason: "limit" });
      }
      const userKey = `user:${username}`;
      if (await txn.get(userKey)) {
        return Response.json({ ok: false, reason: "duplicate" });
      }
      await txn.put("count", count + 1);
      await txn.put(userKey, "1");
      return Response.json({ ok: true });
    });
  }
}

// Invite helpers

async function getInvite(env: Env, token: string): Promise<InviteRecord | null> {
  const hash = await sha256(token);
  const raw = await env.INVITE_KV.get(`invite:${hash}`);
  if (!raw) return null;
  return JSON.parse(raw) as InviteRecord;
}

export function validateInvite(inv: InviteRecord, now = Date.now()): string | null {
  if (inv.revokedAt) return "This invite link has been revoked.";
  if (inv.expiresAt !== null) {
    const exp = new Date(inv.expiresAt);
    if (isNaN(exp.getTime())) return "Invite misconfigured: invalid expiry date.";
    if (now > exp.getTime()) return "This invite link has expired.";
  }
  if (!Number.isInteger(inv.maxClaims) || inv.maxClaims < 0) {
    return "Invite misconfigured: invalid claim limit.";
  }
  return null;
}

export function resolveGitHubToken(env: Env, inv: Pick<InviteRecord, "githubTokenKey">): string | null {
  if (inv.githubTokenKey) {
    if (!env.GITHUB_TOKENS_JSON) return null;

    let tokens: Record<string, string>;
    try {
      tokens = JSON.parse(env.GITHUB_TOKENS_JSON) as Record<string, string>;
    } catch {
      return null;
    }

    return tokens[inv.githubTokenKey] || null;
  }

  return env.GITHUB_TOKEN || null;
}

async function sendInvite(
  env: Env,
  inv: InviteRecord,
  username: string,
): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const githubToken = resolveGitHubToken(env, inv);
  if (!githubToken) return { ok: false, status: 500, msg: "GitHub token is not configured for this invite." };

  const apiBody: Record<string, string> = {};
  if (!inv.omitPermission) apiBody.permission = inv.permission || "pull";

  const apiRes = await fetch(
    `https://api.github.com/repos/${inv.repoOwner}/${inv.repoName}/collaborators/${username}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-invite-broker/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiBody),
    },
  );

  if (apiRes.ok || apiRes.status === 201 || apiRes.status === 204) return { ok: true };

  const errBody = await apiRes.json<{ message?: string }>().catch(() => ({ message: undefined }));
  console.error(`GitHub API ${apiRes.status} for ${username}:`, errBody);

  if (apiRes.status === 422) {
    const m = errBody.message ?? "";
    return {
      ok: false,
      status: 422,
      msg: m.toLowerCase().includes("limit")
        ? "GitHub invite rate limit reached (50/day). Try again tomorrow."
        : m || "GitHub rejected the invite.",
    };
  }
  if (apiRes.status === 403) {
    return { ok: false, status: 502, msg: "Server token lacks permission to invite collaborators." };
  }
  return { ok: false, status: 502, msg: `GitHub API error (${apiRes.status}). Try again later.` };
}

function requireAdmin(request: Request, env: Env): boolean {
  return request.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

function publicUrl(env: Env, token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/?token=${encodeURIComponent(token)}`;
}

function normalizeRecord(input: InviteInput): InviteRecord | { error: string } {
  if (!input.token) return { error: "token required" };
  if (!input.repoOwner || !input.repoName) return { error: "repoOwner and repoName required" };

  const maxClaims = input.maxClaims ?? 0;
  if (!Number.isInteger(maxClaims) || maxClaims < 0) {
    return { error: "maxClaims must be a non-negative integer" };
  }

  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    if (isNaN(new Date(input.expiresAt).getTime())) {
      return { error: "expiresAt must be a valid ISO 8601 date" };
    }
  }

  return {
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    permission: input.permission ?? "pull",
    omitPermission: input.omitPermission ?? false,
    maxClaims,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    githubTokenKey: input.githubTokenKey ?? null,
  };
}

async function verifyGitHubUser(env: Env, inv: InviteRecord, username: string): Promise<string | null> {
  const githubToken = resolveGitHubToken(env, inv);
  if (!githubToken) return "GitHub token is not configured for this invite.";

  const userCheck = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "User-Agent": "github-invite-broker/1.0",
    },
  });
  if (userCheck.status === 404) return `GitHub user @${esc(username)} does not exist.`;
  if (!userCheck.ok) return "Could not verify GitHub username. Please try again.";
  return null;
}

// Resend alert

interface AlertMeta {
  username: string;
  inv: InviteRecord;
  source: "form" | "admin-api";
  ip: string;
  country: string;
  userAgent: string;
  sentAt: string;
}

async function sendResendAlert(env: Env, meta: AlertMeta): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.ALERT_TO_EMAIL) return;

  const { username, inv, source, ip, country, userAgent, sentAt } = meta;
  const repo = `${inv.repoOwner}/${inv.repoName}`;
  const permission = inv.omitPermission ? "(personal repo default)" : inv.permission;
  const tokenKey = inv.githubTokenKey ?? "(fallback)";

  const html = `
<h2>GitHub Repo Invite Sent</h2>
<table style="border-collapse:collapse;font-family:monospace;font-size:14px">
  <tr><td style="padding:4px 12px 4px 0;color:#666">User</td><td><strong>@${esc(username)}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Repo</td><td>${esc(repo)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Permission</td><td>${esc(permission)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Token key</td><td>${esc(tokenKey)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Sent at</td><td>${esc(sentAt)} UTC</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Source</td><td>${esc(source)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">IP</td><td>${esc(ip)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Country</td><td>${esc(country)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">User-Agent</td><td style="word-break:break-all">${esc(userAgent)}</td></tr>
</table>
`.trim();

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [env.ALERT_TO_EMAIL],
      subject: `[invite-broker] @${username} invited to ${repo}`,
      html,
    }),
  }).catch((err) => console.error("Resend alert failed:", err));
}

async function reserveClaim(env: Env, token: string, inv: InviteRecord, username: string) {
  const hash = await sha256(token);
  const stub = env.INVITE_CLAIMS.get(env.INVITE_CLAIMS.idFromName(hash));

  const claimRes = await stub.fetch(new Request("https://do/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxClaims: inv.maxClaims, username }),
  }));
  const claim = await claimRes.json<{ ok: boolean; reason?: string }>();

  return { claim, stub };
}

async function rollbackClaim(stub: DurableObjectStub, username: string): Promise<void> {
  await stub.fetch(new Request("https://do/unclaim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  }));
}

// Worker

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isInvitePath(url.pathname) && request.method === "GET") {
      const token = url.searchParams.get("token") ?? "";
      if (!token) return htmlResp(errorPage("Missing invite token."), 400);
      const inv = await getInvite(env, token);
      if (!inv) return htmlResp(errorPage("Invalid invite link."), 404);
      const err = validateInvite(inv);
      if (err) return htmlResp(errorPage(err), 410);
      return htmlResp(formPage(token, inv));
    }

    if (isInvitePath(url.pathname) && request.method === "POST") {
      const form = await request.formData();
      const token = form.get("token")?.toString() ?? "";
      const username = form.get("username")?.toString().trim() ?? "";

      if (!token) return htmlResp(errorPage("Missing invite token."), 400);

      const inv = await getInvite(env, token);
      if (!inv) return htmlResp(errorPage("Invalid invite link."), 404);

      const invErr = validateInvite(inv);
      if (invErr) return htmlResp(errorPage(invErr), 410);

      if (!username || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(username)) {
        return htmlResp(formPage(token, inv, "Invalid GitHub username format."));
      }

      if (username.toLowerCase() === inv.repoOwner.toLowerCase()) {
        return htmlResp(formPage(token, inv, `@${esc(username)} is the repository owner and already has full access.`));
      }

      const userErr = await verifyGitHubUser(env, inv, username);
      if (userErr) return htmlResp(formPage(token, inv, userErr));

      const { claim, stub } = await reserveClaim(env, token, inv, username);
      if (!claim.ok) {
        const msg = claim.reason === "limit"
          ? "This invite link has reached its use limit."
          : `@${esc(username)} has already been invited via this link.`;
        return htmlResp(formPage(token, inv, msg));
      }

      const result = await sendInvite(env, inv, username);
      if (!result.ok) {
        await rollbackClaim(stub, username);
        return htmlResp(formPage(token, inv, result.msg));
      }

      await sendResendAlert(env, {
        username,
        inv,
        source: "form",
        ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
        country: request.headers.get("CF-IPCountry") ?? "unknown",
        userAgent: request.headers.get("User-Agent") ?? "unknown",
        sentAt: new Date().toISOString(),
      });

      return htmlResp(successPage(username, inv));
    }

    if (url.pathname === `${ADMIN_BASE_PATH}/invite` && request.method === "POST") {
      if (!requireAdmin(request, env)) return new Response("Unauthorized", { status: 401 });

      const body = await request.json<InviteInput>();
      const normalized = normalizeRecord(body);
      if ("error" in normalized) return Response.json({ error: normalized.error }, { status: 400 });

      const hash = await sha256(body.token);
      await env.INVITE_KV.put(`invite:${hash}`, JSON.stringify(normalized));
      return Response.json({ ok: true, url: publicUrl(env, body.token) });
    }

    if (url.pathname === `${ADMIN_BASE_PATH}/send-invite` && request.method === "POST") {
      if (!requireAdmin(request, env)) return new Response("Unauthorized", { status: 401 });

      const { token, username } = await request.json<{ token: string; username: string }>();
      if (!token || !username) return Response.json({ error: "token and username required" }, { status: 400 });

      const inv = await getInvite(env, token);
      if (!inv) return Response.json({ error: "invite not found" }, { status: 404 });

      const invErr = validateInvite(inv);
      if (invErr) return Response.json({ error: invErr }, { status: 410 });

      if (username.toLowerCase() === inv.repoOwner.toLowerCase()) {
        return Response.json({ error: `@${username} is the repository owner` }, { status: 400 });
      }

      const { claim, stub } = await reserveClaim(env, token, inv, username);
      if (!claim.ok) {
        return Response.json({ error: claim.reason === "limit" ? "claim limit reached" : "already claimed" }, { status: 409 });
      }

      const result = await sendInvite(env, inv, username);
      if (!result.ok) {
        await rollbackClaim(stub, username);
        return Response.json({ error: result.msg }, { status: result.status });
      }

      await sendResendAlert(env, {
        username,
        inv,
        source: "admin-api",
        ip: request.headers.get("CF-Connecting-IP") ?? "unknown",
        country: request.headers.get("CF-IPCountry") ?? "unknown",
        userAgent: request.headers.get("User-Agent") ?? "unknown",
        sentAt: new Date().toISOString(),
      });

      return Response.json({ ok: true, invited: username, repo: `${inv.repoOwner}/${inv.repoName}` });
    }

    if (url.pathname === `${ADMIN_BASE_PATH}/revoke` && request.method === "POST") {
      if (!requireAdmin(request, env)) return new Response("Unauthorized", { status: 401 });

      const { token } = await request.json<{ token: string }>();
      if (!token) return Response.json({ error: "token required" }, { status: 400 });

      const hash = await sha256(token);
      const key = `invite:${hash}`;
      const raw = await env.INVITE_KV.get(key);
      if (!raw) return Response.json({ error: "invite not found" }, { status: 404 });

      const record = JSON.parse(raw) as InviteRecord;
      record.revokedAt = new Date().toISOString();
      await env.INVITE_KV.put(key, JSON.stringify(record));
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },
};

export default worker;
