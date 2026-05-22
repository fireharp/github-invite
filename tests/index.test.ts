import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sha256, validateInvite, resolveGitHubToken, worker, type Env, type InviteRecord } from "../src/index";

const baseInvite: InviteRecord = {
  repoOwner: "fireharp",
  repoName: "better-stack-assignment",
  permission: "pull",
  omitPermission: true,
  maxClaims: 0,
  expiresAt: "2026-06-01T00:00:00Z",
  revokedAt: null,
  githubTokenKey: null,
};

class FakeKV {
  private values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

class FakeStorage {
  values = new Map<string, unknown>();

  async transaction<T>(fn: (txn: FakeStorage) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class FakeClaimsNamespace {
  storages = new Map<string, FakeStorage>();

  idFromName(name: string): DurableObjectId {
    return name as unknown as DurableObjectId;
  }

  get(id: DurableObjectId): DurableObjectStub {
    const name = id as unknown as string;
    let storage = this.storages.get(name);
    if (!storage) {
      storage = new FakeStorage();
      this.storages.set(name, storage);
    }

    return {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const body = await request.json<{ username: string; maxClaims?: number }>();
        const username = body.username.toLowerCase();

        if (url.pathname === "/unclaim") {
          const userKey = `user:${username}`;
          const existed = await storage.get(userKey);
          if (existed) {
            const count = (await storage.get("count") as number | undefined) ?? 0;
            await storage.delete(userKey);
            await storage.put("count", Math.max(0, count - 1));
          }
          return Response.json({ ok: true });
        }

        const maxClaims = body.maxClaims ?? 0;
        const count = (await storage.get("count") as number | undefined) ?? 0;
        if (maxClaims > 0 && count >= maxClaims) return Response.json({ ok: false, reason: "limit" });

        const userKey = `user:${username}`;
        if (await storage.get(userKey)) return Response.json({ ok: false, reason: "duplicate" });

        await storage.put("count", count + 1);
        await storage.put(userKey, "1");
        return Response.json({ ok: true });
      },
    } as DurableObjectStub;
  }
}

async function makeEnv(record?: InviteRecord, token = "share-token"): Promise<Env & { kv: FakeKV; claims: FakeClaimsNamespace }> {
  const kv = new FakeKV();
  if (record) await kv.put(`invite:${await sha256(token)}`, JSON.stringify(record));
  const claims = new FakeClaimsNamespace();
  return {
    kv,
    claims,
    INVITE_KV: kv as unknown as KVNamespace,
    INVITE_CLAIMS: claims as unknown as DurableObjectNamespace,
    GITHUB_TOKEN: "fallback-token",
    APP_URL: "https://github-invite.fireharp.com",
    ADMIN_TOKEN: "admin-secret",
  };
}

describe("invite validation", () => {
  it("rejects expired invites", () => {
    expect(validateInvite({ ...baseInvite, expiresAt: "2026-01-01T00:00:00Z" }, Date.parse("2026-02-01T00:00:00Z")))
      .toBe("This invite link has expired.");
  });

  it("rejects revoked invites", () => {
    expect(validateInvite({ ...baseInvite, revokedAt: "2026-05-22T00:00:00Z" })).toBe("This invite link has been revoked.");
  });

  it("rejects invalid claim limits", () => {
    expect(validateInvite({ ...baseInvite, maxClaims: -1 })).toBe("Invite misconfigured: invalid claim limit.");
  });
});

describe("GitHub token selection", () => {
  it("uses the fallback token when no key is set", () => {
    expect(resolveGitHubToken({ GITHUB_TOKEN: "fallback" } as Env, { githubTokenKey: null })).toBe("fallback");
  });

  it("uses the named token from JSON when a key is set", () => {
    expect(resolveGitHubToken({ GITHUB_TOKENS_JSON: '{"client":"pat"}' } as Env, { githubTokenKey: "client" })).toBe("pat");
  });

  it("fails closed when a named token is missing", () => {
    expect(resolveGitHubToken({ GITHUB_TOKEN: "fallback", GITHUB_TOKENS_JSON: "{}" } as Env, { githubTokenKey: "client" })).toBeNull();
  });
});

describe("worker routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("requires a token at the public root", async () => {
    const env = await makeEnv();
    const res = await worker.fetch(new Request("https://github-invite.fireharp.com/"), env);

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing invite token.");
  });

  it("renders the invite form for a valid token", async () => {
    const env = await makeEnv(baseInvite);
    const res = await worker.fetch(new Request("https://github-invite.fireharp.com/?token=share-token"), env);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Private Repo Invite");
    expect(html).toContain('data-theme-option="system"');
    expect(html).toContain('data-theme-option="light"');
    expect(html).toContain('data-theme-option="dark"');
    expect(html).toContain("github-invite-theme");
  });

  it("requires admin auth", async () => {
    const env = await makeEnv();
    const res = await worker.fetch(new Request("https://github-invite.fireharp.com/admin/invite", { method: "POST" }), env);

    expect(res.status).toBe(401);
  });

  it("creates an invite with a named credential key", async () => {
    const env = await makeEnv();
    const res = await worker.fetch(new Request("https://github-invite.fireharp.com/admin/invite", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: "new-token",
        repoOwner: "fireharp",
        repoName: "better-stack-assignment",
        githubTokenKey: "client-a",
      }),
    }), env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://github-invite.fireharp.com/?token=new-token" });

    const raw = await env.kv.get(`invite:${await sha256("new-token")}`);
    expect(JSON.parse(raw ?? "{}")).toMatchObject({ githubTokenKey: "client-a" });
  });

  it("enforces duplicate claims", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const env = await makeEnv({ ...baseInvite, maxClaims: 2 });
    const body = new URLSearchParams({ token: "share-token", username: "octocat" });

    const first = await worker.fetch(new Request("https://github-invite.fireharp.com/", { method: "POST", body }), env);
    const second = await worker.fetch(new Request("https://github-invite.fireharp.com/", { method: "POST", body }), env);

    expect(first.status).toBe(200);
    expect(await first.text()).toContain("Invite sent");
    expect(second.status).toBe(200);
    expect(await second.text()).toContain("already been invited");
  });

  it("rolls back a claim when GitHub invite fails", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "nope" }), { status: 422 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));

    const env = await makeEnv({ ...baseInvite, maxClaims: 1 });
    const failed = new URLSearchParams({ token: "share-token", username: "octocat" });
    const retried = new URLSearchParams({ token: "share-token", username: "monalisa" });

    const first = await worker.fetch(new Request("https://github-invite.fireharp.com/", { method: "POST", body: failed }), env);
    const second = await worker.fetch(new Request("https://github-invite.fireharp.com/", { method: "POST", body: retried }), env);

    expect(await first.text()).toContain("nope");
    expect(await second.text()).toContain("Invite sent");
  });
});
