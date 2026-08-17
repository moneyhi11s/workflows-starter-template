type OAuthEnv = Env & {
  OAUTH_SETUP_KEY?: string;
  OAUTH_TOKEN_KEY?: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
};

type Provider = "youtube" | "tiktok";

type StoredToken = {
  provider: Provider;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  open_id?: string;
  expires_at: number;
  refresh_expires_at?: number;
  updated_at: number;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function oauthStub(env: Env) {
  const id = env.WORKFLOW_STATUS.idFromName("moneyhi11s-oauth-v1");
  return env.WORKFLOW_STATUS.get(id) as any;
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function setupAuthorized(url: URL, env: OAuthEnv): boolean {
  return safeEqual(url.searchParams.get("key") || "", env.OAUTH_SETUP_KEY || "");
}

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromB64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function cryptoKey(env: OAuthEnv): Promise<CryptoKey> {
  if (!env.OAUTH_TOKEN_KEY) throw new Error("OAUTH_TOKEN_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(env.OAUTH_TOKEN_KEY));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(env: OAuthEnv, token: StoredToken): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(env),
    enc.encode(JSON.stringify(token)),
  );
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

async function decryptToken(env: OAuthEnv, value: string): Promise<StoredToken> {
  const [ivPart, cipherPart] = value.split(".");
  if (!ivPart || !cipherPart) throw new Error("Invalid encrypted token");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivPart) },
    await cryptoKey(env),
    fromB64(cipherPart),
  );
  return JSON.parse(dec.decode(plain)) as StoredToken;
}

async function readStored(env: OAuthEnv, provider: Provider): Promise<StoredToken | null> {
  const blob = await oauthStub(env).getOAuthBlob(provider);
  if (!blob) return null;
  return decryptToken(env, blob);
}

async function writeStored(env: OAuthEnv, token: StoredToken): Promise<void> {
  const blob = await encryptToken(env, token);
  await oauthStub(env).putOAuthBlob(token.provider, blob, {
    connected: true,
    scope: token.scope || "",
    openId: token.open_id || "",
    expiresAt: token.expires_at,
    refreshExpiresAt: token.refresh_expires_at || 0,
    updatedAt: token.updated_at,
  });
}

async function rememberState(env: Env, provider: Provider, state: string): Promise<void> {
  await oauthStub(env).putOAuthState(provider, state, Date.now() + 10 * 60 * 1000);
}

async function validState(env: Env, provider: Provider, state: string): Promise<boolean> {
  return Boolean(await oauthStub(env).consumeOAuthState(provider, state));
}

function successPage(provider: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Moneyhi11s connected</title><body style="font-family:system-ui;max-width:700px;margin:60px auto;padding:0 20px"><h1>${provider} connected</h1><p>The authorization token was stored server-side for Moneyhi11s. You can close this tab.</p></body>`,
    { headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-store" } },
  );
}

function configError(message: string, status = 503): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

async function refreshYouTube(env: OAuthEnv, stored: StoredToken): Promise<StoredToken> {
  if (!stored.refresh_token || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
    throw new Error("YouTube refresh credentials are incomplete");
  }
  const body = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID,
    client_secret: env.YOUTUBE_CLIENT_SECRET,
    refresh_token: stored.refresh_token,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as Record<string, any>;
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "YouTube token refresh failed");
  const next: StoredToken = {
    ...stored,
    access_token: String(data.access_token),
    token_type: String(data.token_type || stored.token_type || "Bearer"),
    scope: String(data.scope || stored.scope || ""),
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
    updated_at: Date.now(),
  };
  await writeStored(env, next);
  return next;
}

async function refreshTikTok(env: OAuthEnv, stored: StoredToken): Promise<StoredToken> {
  if (!stored.refresh_token || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok refresh credentials are incomplete");
  }
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as Record<string, any>;
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "TikTok token refresh failed");
  const now = Date.now();
  const next: StoredToken = {
    ...stored,
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token || stored.refresh_token),
    token_type: String(data.token_type || "Bearer"),
    scope: String(data.scope || stored.scope || ""),
    open_id: String(data.open_id || stored.open_id || ""),
    expires_at: now + Number(data.expires_in || 86400) * 1000,
    refresh_expires_at: now + Number(data.refresh_expires_in || 31536000) * 1000,
    updated_at: now,
  };
  await writeStored(env, next);
  return next;
}

export async function getProviderAccessToken(env: Env, provider: Provider): Promise<string> {
  const typed = env as OAuthEnv;
  let stored = await readStored(typed, provider);
  if (!stored) throw new Error(`${provider} is not connected`);
  if (stored.expires_at <= Date.now() + 5 * 60 * 1000) {
    stored = provider === "youtube" ? await refreshYouTube(typed, stored) : await refreshTikTok(typed, stored);
  }
  return stored.access_token;
}

export async function handleOAuthRoute(request: Request, env: Env): Promise<Response | null> {
  const typed = env as OAuthEnv;
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  if (url.pathname === "/api/oauth/status" && request.method === "GET") {
    const status = await oauthStub(env).getOAuthStatus();
    return Response.json({
      youtube: status.youtube || { connected: false },
      tiktok: status.tiktok || { connected: false },
      meta: { connected: false, readyForOAuthApp: false, note: "Meta app credentials not configured in this Worker yet." },
    }, { headers: { "cache-control": "no-store" } });
  }

  if (url.pathname === "/connect/youtube" && request.method === "GET") {
    if (!setupAuthorized(url, typed)) return configError("unauthorized setup request", 401);
    if (!typed.YOUTUBE_CLIENT_ID || !typed.YOUTUBE_CLIENT_SECRET || !typed.OAUTH_TOKEN_KEY) {
      return configError("Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and OAUTH_TOKEN_KEY first");
    }
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await rememberState(env, "youtube", state);
    const redirectUri = `${base}/oauth/youtube/callback`;
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.searchParams.set("client_id", typed.YOUTUBE_CLIENT_ID);
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload");
    target.searchParams.set("access_type", "offline");
    target.searchParams.set("include_granted_scopes", "true");
    target.searchParams.set("prompt", "consent");
    target.searchParams.set("state", state);
    return Response.redirect(target.toString(), 302);
  }

  if (url.pathname === "/oauth/youtube/callback" && request.method === "GET") {
    const error = url.searchParams.get("error");
    if (error) return configError(`YouTube authorization denied: ${error}`, 400);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !(await validState(env, "youtube", state))) return configError("invalid or expired OAuth state", 400);
    if (!typed.YOUTUBE_CLIENT_ID || !typed.YOUTUBE_CLIENT_SECRET || !typed.OAUTH_TOKEN_KEY) return configError("YouTube OAuth secrets are not configured");
    const redirectUri = `${base}/oauth/youtube/callback`;
    const body = new URLSearchParams({
      client_id: typed.YOUTUBE_CLIENT_ID,
      client_secret: typed.YOUTUBE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await response.json()) as Record<string, any>;
    if (!response.ok || !data.access_token) return configError(data.error_description || data.error || "YouTube token exchange failed", 400);
    const existing = await readStored(typed, "youtube");
    const now = Date.now();
    await writeStored(typed, {
      provider: "youtube",
      access_token: String(data.access_token),
      refresh_token: String(data.refresh_token || existing?.refresh_token || "") || undefined,
      token_type: String(data.token_type || "Bearer"),
      scope: String(data.scope || "https://www.googleapis.com/auth/youtube.upload"),
      expires_at: now + Number(data.expires_in || 3600) * 1000,
      updated_at: now,
    });
    return successPage("YouTube");
  }

  if (url.pathname === "/connect/tiktok" && request.method === "GET") {
    if (!setupAuthorized(url, typed)) return configError("unauthorized setup request", 401);
    if (!typed.TIKTOK_CLIENT_KEY || !typed.TIKTOK_CLIENT_SECRET || !typed.OAUTH_TOKEN_KEY) {
      return configError("Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and OAUTH_TOKEN_KEY first");
    }
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await rememberState(env, "tiktok", state);
    const redirectUri = `${base}/oauth/tiktok/callback`;
    const target = new URL("https://www.tiktok.com/v2/auth/authorize/");
    target.searchParams.set("client_key", typed.TIKTOK_CLIENT_KEY);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("scope", "video.publish");
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("state", state);
    return Response.redirect(target.toString(), 302);
  }

  if (url.pathname === "/oauth/tiktok/callback" && request.method === "GET") {
    const error = url.searchParams.get("error") || url.searchParams.get("error_description");
    if (error) return configError(`TikTok authorization denied: ${error}`, 400);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !(await validState(env, "tiktok", state))) return configError("invalid or expired OAuth state", 400);
    if (!typed.TIKTOK_CLIENT_KEY || !typed.TIKTOK_CLIENT_SECRET || !typed.OAUTH_TOKEN_KEY) return configError("TikTok OAuth secrets are not configured");
    const redirectUri = `${base}/oauth/tiktok/callback`;
    const body = new URLSearchParams({
      client_key: typed.TIKTOK_CLIENT_KEY,
      client_secret: typed.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await response.json()) as Record<string, any>;
    if (!response.ok || !data.access_token) return configError(data.error_description || data.error || "TikTok token exchange failed", 400);
    const now = Date.now();
    await writeStored(typed, {
      provider: "tiktok",
      access_token: String(data.access_token),
      refresh_token: String(data.refresh_token || "") || undefined,
      token_type: String(data.token_type || "Bearer"),
      scope: String(data.scope || "video.publish"),
      open_id: String(data.open_id || ""),
      expires_at: now + Number(data.expires_in || 86400) * 1000,
      refresh_expires_at: now + Number(data.refresh_expires_in || 31536000) * 1000,
      updated_at: now,
    });
    return successPage("TikTok");
  }

  if (url.pathname === "/api/oauth/refresh" && request.method === "POST") {
    if (!setupAuthorized(url, typed)) return configError("unauthorized setup request", 401);
    const provider = url.searchParams.get("provider");
    if (provider !== "youtube" && provider !== "tiktok") return configError("provider must be youtube or tiktok", 400);
    try {
      await getProviderAccessToken(env, provider);
      return Response.json({ ok: true, provider });
    } catch (error) {
      return configError(error instanceof Error ? error.message : "refresh failed", 400);
    }
  }

  return null;
}
