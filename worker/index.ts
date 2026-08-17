export { MyWorkflow } from "./workflow";
export { WorkflowStatusDO } from "./durable-object";

const OFFERS = {
  cpm: {
    name: "Copy Paste Millionaire",
    affiliateUrl: "https://nexagroup.a.explodely.com/?aff=moneyhi11s&pid=400288355",
  },
  aica: {
    name: "AICA-247",
    affiliateUrl: "https://millionaire.a.explodely.com/?aff=moneyhi11s&pid=288853053",
  },
  profitloop: {
    name: "Profit Loop",
    affiliateUrl: "https://neomedias.a.explodely.com/?aff=moneyhi11s&pid=1413241209",
  },
} as const;

type OfferKey = keyof typeof OFFERS;
type EnvWithSecret = Env & { ISN_SECRET?: string };

function sanitizeToken(value: string | null, fallback: string, max = 32): string {
  const cleaned = (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
  return cleaned || fallback;
}

function offerKey(value: string | null): OfferKey {
  const candidate = sanitizeToken(value, "cpm", 24) as OfferKey;
  return candidate in OFFERS ? candidate : "cpm";
}

function dashboardStub(env: Env) {
  const id = env.WORKFLOW_STATUS.idFromName("moneyhi11s-dashboard");
  return env.WORKFLOW_STATUS.get(id) as any;
}

async function parseIncoming(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const data: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (key !== "key") data[key] = value;
  });

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) data[key] = String(value);
      }
    } else {
      const text = await request.text();
      const form = new URLSearchParams(text);
      form.forEach((value, key) => {
        data[key] = value;
      });
    }
  }
  return data;
}

function authorized(url: URL, env: Env): boolean {
  const secret = (env as EnvWithSecret).ISN_SECRET || "";
  const supplied = url.searchParams.get("key") || "";
  return Boolean(secret) && supplied === secret;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "moneyhi11s-revenue-engine", version: 3 });
    }

    if (url.pathname === "/api/offers" && request.method === "GET") {
      return Response.json(
        Object.entries(OFFERS).map(([key, offer]) => ({ key, name: offer.name })),
        { headers: { "cache-control": "public, max-age=300" } },
      );
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      const stats = await dashboardStub(env).getStats();
      return Response.json(stats, { headers: { "cache-control": "no-store" } });
    }

    const goMatch = /^\/go\/([a-z0-9-]+)$/.exec(url.pathname);
    if (goMatch && request.method === "GET") {
      const offer = offerKey(goMatch[1]);
      const source = sanitizeToken(url.searchParams.get("src"), "direct", 32);
      const tid = `mh1.${offer}.${source}.${Date.now().toString(36)}.${crypto.randomUUID().slice(0, 8)}`;
      await dashboardStub(env).recordClick({ source, offer, tid, timestamp: Date.now() });

      const target = new URL(OFFERS[offer].affiliateUrl);
      target.searchParams.set("tid", tid);
      return Response.redirect(target.toString(), 302);
    }

    if (
      url.pathname === "/api/explodely/isn" &&
      (request.method === "GET" || request.method === "POST")
    ) {
      if (!authorized(url, env)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let incoming: Record<string, string>;
      try {
        incoming = await parseIncoming(request);
      } catch {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if ((incoming.transactiontype || "").toLowerCase() !== "sale") {
        return Response.json({ accepted: false, reason: "not a sale" }, { status: 202 });
      }

      const orderid = (incoming.orderid || "").trim();
      const amount = Number(incoming.amount);
      if (!orderid || !Number.isFinite(amount) || amount < 0) {
        return Response.json({ error: "missing/invalid orderid or amount" }, { status: 400 });
      }

      const payload = {
        orderid,
        amount,
        seller: incoming.seller || "",
        tid: incoming.tid || "",
        affcup: incoming.affcup || "",
        country: incoming.country || "",
        saletimestamp: incoming.saletimestamp || "",
        receivedAt: Date.now(),
      };

      const safeOrderId = orderid.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
      const instanceId = `explodely-sale-${safeOrderId}`;
      try {
        const instance = await env.MY_WORKFLOW.create({ id: instanceId, params: payload });
        return Response.json({ accepted: true, instanceId: instance.id });
      } catch {
        return Response.json({ accepted: true, duplicate: true, instanceId });
      }
    }

    if (
      url.pathname === "/api/explodely/refund" &&
      (request.method === "GET" || request.method === "POST")
    ) {
      if (!authorized(url, env)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let incoming: Record<string, string>;
      try {
        incoming = await parseIncoming(request);
      } catch {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const kind = (incoming.transactiontype || incoming.type || "refund").toLowerCase();
      if (kind !== "refund") {
        return Response.json({ accepted: false, reason: "not a refund" }, { status: 202 });
      }

      const orderid = (incoming.orderid || "").trim();
      const parsedAmount = Number(incoming.amount);
      if (!orderid) return Response.json({ error: "orderid required" }, { status: 400 });

      const result = await dashboardStub(env).recordRefund({
        orderid,
        amount: Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0,
        receivedAt: Date.now(),
      });
      return Response.json({ accepted: true, ...result });
    }

    if (url.pathname.startsWith("/api/workflow/status/")) {
      const instanceId = url.pathname.split("/").pop();
      if (!instanceId) return Response.json({ error: "Instance ID required" }, { status: 400 });
      try {
        const instance = await env.MY_WORKFLOW.get(instanceId);
        return Response.json(await instance.status());
      } catch {
        return Response.json({ error: "Failed to get workflow status" }, { status: 500 });
      }
    }

    if (url.pathname === "/ws") {
      const instanceId = url.searchParams.get("instanceId");
      if (!instanceId) return new Response("instanceId query parameter required", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      const doId = env.WORKFLOW_STATUS.idFromName(instanceId);
      return env.WORKFLOW_STATUS.get(doId).fetch(request);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
