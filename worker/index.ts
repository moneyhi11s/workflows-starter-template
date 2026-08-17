export { MyWorkflow } from "./workflow";
export { WorkflowStatusDO } from "./durable-object";

const OFFERS = {
  cpm: {
    name: "Copy Paste Millionaire",
    slug: "copy-paste-millionaire",
    affiliateUrl: "https://nexagroup.a.explodely.com/?aff=moneyhi11s&pid=400288355",
    snapshot: { price: 97, commission: "75% RevShare", refundRate: 11.38, avgSale: 34.41 },
  },
  aica: {
    name: "AICA-247",
    slug: "aica-247",
    affiliateUrl: "https://millionaire.a.explodely.com/?aff=moneyhi11s&pid=288853053",
    snapshot: { price: 47, commission: "50% RevShare", refundRate: 9.52, avgSale: 33.84 },
  },
  profitloop: {
    name: "Profit Loop",
    slug: "profit-loop",
    affiliateUrl: "https://neomedias.a.explodely.com/?aff=moneyhi11s&pid=1413241209",
    snapshot: { price: 47, commission: "50% RevShare", refundRate: 14.14, avgSale: 28.86 },
  },
} as const;

type OfferKey = keyof typeof OFFERS;
type EnvWithSecret = Env & { ISN_SECRET?: string };

const SITE_NAME = "Moneyhi11s";
const SITE_DESCRIPTION = "Buyer-first reviews, comparisons, and tracked tests of online business tools and digital offers.";

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

function offerFromSlug(slug: string): OfferKey | null {
  const entry = Object.entries(OFFERS).find(([, offer]) => offer.slug === slug);
  return entry ? (entry[0] as OfferKey) : null;
}

function dashboardStub(env: Env) {
  const id = env.WORKFLOW_STATUS.idFromName("moneyhi11s-dashboard");
  return env.WORKFLOW_STATUS.get(id) as any;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] || char);
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

function pageShell(input: { title: string; description: string; canonical: string; body: string }): string {
  const title = esc(input.title);
  const description = esc(input.description);
  const canonical = esc(input.canonical);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">
<style>body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;margin:0;background:#0a0a0a;color:#f4f4f5}main{max-width:860px;margin:auto;padding:40px 20px 72px}a{color:#93c5fd}nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:34px}.card{border:1px solid #27272a;border-radius:16px;padding:22px;margin:18px 0;background:#111113}.cta{display:inline-block;background:#f4f4f5;color:#111827;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700}.muted{color:#a1a1aa}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.metric{font-size:1.25rem;font-weight:700}h1{font-size:clamp(2rem,6vw,3.5rem);line-height:1.05}h2{margin-top:34px}.disclosure{font-size:.92rem;border-left:3px solid #71717a;padding-left:14px;color:#d4d4d8}</style></head><body><main><nav><a href="/">Moneyhi11s</a><a href="/compare">Compare</a><a href="/reviews/copy-paste-millionaire">CPM review</a><a href="/reviews/aica-247">AICA-247 review</a><a href="/reviews/profit-loop">Profit Loop review</a></nav>${input.body}</main></body></html>`;
}

function reviewPage(base: string, key: OfferKey): Response {
  const offer = OFFERS[key];
  const canonical = `${base}/reviews/${offer.slug}`;
  const source = `seo-review-${offer.slug}`.slice(0, 32);
  const body = `<p class="muted">Moneyhi11s buyer check · marketplace snapshot captured August 2026</p>
<h1>${esc(offer.name)} review: what to verify before buying</h1>
<p>This page is a buyer-first checklist, not an earnings promise. Online-income products vary widely in quality, support, refund behavior, and fit. Verify the current checkout terms and product details before purchasing.</p>
<div class="card"><h2>Captured marketplace snapshot</h2><div class="grid"><div><div class="muted">Listed price</div><div class="metric">$${offer.snapshot.price}</div></div><div><div class="muted">Affiliate structure</div><div class="metric">${esc(offer.snapshot.commission)}</div></div><div><div class="muted">Captured avg./sale</div><div class="metric">$${offer.snapshot.avgSale.toFixed(2)}</div></div><div><div class="muted">Captured refund rate</div><div class="metric">${offer.snapshot.refundRate.toFixed(2)}%</div></div></div><p class="muted">These are historical marketplace figures captured in August 2026 and can change. They are not customer earnings claims.</p></div>
<h2>Check these before you buy</h2><div class="card"><ol><li>What exactly is delivered after purchase?</li><li>Are there recurring charges, upsells, or extra tools required?</li><li>What is the current refund policy and deadline?</li><li>Does the training require paid advertising or additional software?</li><li>Can you verify examples and claims independently?</li></ol></div>
<h2>Who should skip it?</h2><p>Skip any digital-business product if you need guaranteed income, cannot afford the purchase, or are relying on a specific earnings outcome. No legitimate affiliate review can guarantee your results.</p>
<p><a class="cta" rel="sponsored nofollow" href="/go/${key}?src=${source}">Check the current ${esc(offer.name)} offer</a></p>
<p class="disclosure">Affiliate disclosure: Moneyhi11s may earn a commission if you purchase through a tracked link. That does not increase the listed price. We use tracked links to measure which pages and campaigns produce confirmed sales.</p>`;
  return htmlResponse(pageShell({ title: `${offer.name} Review (2026 Buyer Check) | Moneyhi11s`, description: `A buyer-first ${offer.name} review with a captured August 2026 marketplace snapshot and a checklist of what to verify before purchase.`, canonical, body }));
}

function comparePage(base: string): Response {
  const rows = Object.entries(OFFERS).map(([key, offer]) => `<div class="card"><h2>${esc(offer.name)}</h2><p><strong>$${offer.snapshot.price}</strong> listed price · ${esc(offer.snapshot.commission)}</p><p>Captured avg./sale: $${offer.snapshot.avgSale.toFixed(2)} · captured refund rate: ${offer.snapshot.refundRate.toFixed(2)}%</p><p class="muted">Snapshot captured August 2026. Marketplace values can change.</p><a class="cta" href="/reviews/${offer.slug}">Read buyer check</a> <a rel="sponsored nofollow" href="/go/${key}?src=seo-compare">Check current offer</a></div>`).join("");
  const body = `<p class="muted">Moneyhi11s comparison hub</p><h1>Compare the current Moneyhi11s test offers</h1><p>We compare offers using buyer relevance, confirmed conversion data, refund-adjusted commission, and EPC—not headline commission alone.</p>${rows}<p class="disclosure">Affiliate disclosure: tracked offer links are sponsored affiliate links. Historical marketplace metrics are labeled as snapshots and are not promises of future results.</p>`;
  return htmlResponse(pageShell({ title: "Compare Online Business Offers | Moneyhi11s", description: "Compare Moneyhi11s test offers using buyer-fit checks and transparent historical marketplace snapshots.", canonical: `${base}/compare`, body }));
}

function contentQueue(base: string) {
  const items = [
    { platform: "tiktok", angle: "review", hook: "Before you spend $97 on another online-income program, check these 3 things first.", offer: "cpm" },
    { platform: "youtube", angle: "comparison", hook: "I compared three online-business offers by price, refund rate, and what buyers should verify before paying.", offer: "cpm" },
    { platform: "instagram", angle: "warning", hook: "High commission does not automatically mean a better product. Here is what I check instead.", offer: "aica" },
    { platform: "tiktok", angle: "comparison", hook: "$47 vs $97 digital-business offers: the price is not the only number that matters.", offer: "aica" },
    { platform: "youtube", angle: "buyer-check", hook: "Five questions to ask before buying any make-money-online course or software bundle.", offer: "profitloop" },
    { platform: "instagram", angle: "review", hook: "A buyer-first way to evaluate online-income products without falling for earnings hype.", offer: "cpm" },
  ] as const;
  return items.map((item, i) => {
    const key = item.offer as OfferKey;
    const src = `${item.platform}-${item.angle}-${String(i + 1).padStart(2, "0")}`;
    return {
      ...item,
      source: src,
      landingUrl: `${base}/reviews/${OFFERS[key].slug}?src=${src}`,
      directTrackedUrl: `${base}/go/${key}?src=${src}`,
      disclosure: "Affiliate link — Moneyhi11s may earn a commission from qualifying purchases.",
      cta: "See the buyer check before you decide.",
    };
  });
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
    const base = `${url.protocol}//${url.host}`;

    if (url.pathname === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=UTF-8", "cache-control": "public, max-age=3600" } });
    }

    if (url.pathname === "/sitemap.xml") {
      const paths = ["/", "/compare", ...Object.values(OFFERS).map((offer) => `/reviews/${offer.slug}`)];
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${base}${path}</loc><changefreq>weekly</changefreq></url>`).join("")}</urlset>`;
      return new Response(xml, { headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=3600" } });
    }

    if (url.pathname === "/feed.xml") {
      const entries = Object.values(OFFERS).map((offer) => `<entry><title>${esc(offer.name)} buyer check</title><id>${base}/reviews/${offer.slug}</id><link href="${base}/reviews/${offer.slug}"/><updated>2026-08-17T00:00:00Z</updated><summary>Buyer-first review and verification checklist.</summary></entry>`).join("");
      const feed = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${SITE_NAME}</title><id>${base}/</id><updated>2026-08-17T00:00:00Z</updated>${entries}</feed>`;
      return new Response(feed, { headers: { "content-type": "application/atom+xml; charset=UTF-8", "cache-control": "public, max-age=3600" } });
    }

    if (url.pathname === "/compare" && request.method === "GET") return comparePage(base);
    const reviewMatch = /^\/reviews\/([a-z0-9-]+)$/.exec(url.pathname);
    if (reviewMatch && request.method === "GET") {
      const key = offerFromSlug(reviewMatch[1]);
      if (key) return reviewPage(base, key);
    }

    if (url.pathname === "/api/content" && request.method === "GET") {
      return Response.json({ generatedAt: new Date().toISOString(), strategy: "buyer-first-review-comparison", items: contentQueue(base) }, { headers: { "cache-control": "public, max-age=300" } });
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "moneyhi11s-revenue-engine", version: 3, trafficFoundation: true });
    }

    if (url.pathname === "/api/offers" && request.method === "GET") {
      return Response.json(Object.entries(OFFERS).map(([key, offer]) => ({ key, name: offer.name, slug: offer.slug })), { headers: { "cache-control": "public, max-age=300" } });
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

    if (url.pathname === "/api/explodely/isn" && (request.method === "GET" || request.method === "POST")) {
      if (!authorized(url, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
      let incoming: Record<string, string>;
      try { incoming = await parseIncoming(request); } catch { return Response.json({ error: "invalid payload" }, { status: 400 }); }
      if ((incoming.transactiontype || "").toLowerCase() !== "sale") return Response.json({ accepted: false, reason: "not a sale" }, { status: 202 });
      const orderid = (incoming.orderid || "").trim();
      const amount = Number(incoming.amount);
      if (!orderid || !Number.isFinite(amount) || amount < 0) return Response.json({ error: "missing/invalid orderid or amount" }, { status: 400 });
      const payload = { orderid, amount, seller: incoming.seller || "", tid: incoming.tid || "", affcup: incoming.affcup || "", country: incoming.country || "", saletimestamp: incoming.saletimestamp || "", receivedAt: Date.now() };
      const safeOrderId = orderid.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
      const instanceId = `explodely-sale-${safeOrderId}`;
      try {
        const instance = await env.MY_WORKFLOW.create({ id: instanceId, params: payload });
        return Response.json({ accepted: true, instanceId: instance.id });
      } catch {
        return Response.json({ accepted: true, duplicate: true, instanceId });
      }
    }

    if (url.pathname === "/api/explodely/refund" && (request.method === "GET" || request.method === "POST")) {
      if (!authorized(url, env)) return Response.json({ error: "unauthorized" }, { status: 401 });
      let incoming: Record<string, string>;
      try { incoming = await parseIncoming(request); } catch { return Response.json({ error: "invalid payload" }, { status: 400 }); }
      const kind = (incoming.transactiontype || incoming.type || "refund").toLowerCase();
      if (kind !== "refund") return Response.json({ accepted: false, reason: "not a refund" }, { status: 202 });
      const orderid = (incoming.orderid || "").trim();
      const parsedAmount = Number(incoming.amount);
      if (!orderid) return Response.json({ error: "orderid required" }, { status: 400 });
      const result = await dashboardStub(env).recordRefund({ orderid, amount: Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0, receivedAt: Date.now() });
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
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected Upgrade: websocket", { status: 426 });
      const doId = env.WORKFLOW_STATUS.idFromName(instanceId);
      return env.WORKFLOW_STATUS.get(doId).fetch(request);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
