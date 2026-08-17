import { DurableObject } from "cloudflare:workers";

type PerformanceStats = {
  clicks: number;
  sales: number;
  refunds: number;
  grossCommission: number;
  netCommission: number;
};

type ClickRecord = { source: string; offer: string; tid: string; timestamp: number };
type SaleRecord = {
  orderid: string;
  amount: number;
  seller: string;
  tid: string;
  source: string;
  offer: string;
  country: string;
  saletimestamp: string;
  receivedAt: number;
  refundedAmount?: number;
  refundedAt?: number;
};

type RefundInput = { orderid: string; amount: number; receivedAt: number };

const blank = (): PerformanceStats => ({
  clicks: 0,
  sales: 0,
  refunds: 0,
  grossCommission: 0,
  netCommission: 0,
});

function monthKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 7);
}

function fallbackAttribution(tid: string): { offer: string; source: string } {
  if (tid.startsWith("mh1.")) {
    const parts = tid.split(".");
    return { offer: parts[1] || "cpm", source: parts[2] || "other" };
  }
  if (tid.startsWith("cpm_")) {
    const parts = tid.split("_");
    const source = parts.length >= 4 ? parts.slice(1, -2).join("_") : "other";
    return { offer: "cpm", source: source || "other" };
  }
  return { offer: "unknown", source: "other" };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export class WorkflowStatusDO extends DurableObject {
  private stepStatuses = new Map<string, string>();
  private currentStep: string | null = null;
  private workflowStatus: "running" | "completed" | "error" = "running";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const storedStatuses = await ctx.storage.get<Record<string, string>>("stepStatuses");
      const storedCurrent = await ctx.storage.get<string | null>("currentStep");
      const storedWorkflowStatus = await ctx.storage.get<"running" | "completed" | "error">("workflowStatus");
      if (storedStatuses) this.stepStatuses = new Map(Object.entries(storedStatuses));
      this.currentStep = storedCurrent ?? null;
      this.workflowStatus = storedWorkflowStatus ?? "running";

      const migrated = await ctx.storage.get<boolean>("metric:v3:migrated");
      if (!migrated) {
        const legacyClicks = (await ctx.storage.get<number>("revenue:clicks")) || 0;
        const legacySales = (await ctx.storage.get<number>("revenue:sales")) || 0;
        const legacyCommission = (await ctx.storage.get<number>("revenue:commission")) || 0;
        const legacyCampaigns = (await ctx.storage.get<Record<string, { clicks: number; sales: number; commission: number }>>("revenue:campaigns")) || {};
        if (legacyClicks || legacySales || legacyCommission || Object.keys(legacyCampaigns).length) {
          await ctx.storage.put("metric:total", { clicks: legacyClicks, sales: legacySales, refunds: 0, grossCommission: legacyCommission, netCommission: legacyCommission });
          const campaignsV3: Record<string, PerformanceStats> = {};
          for (const [source, row] of Object.entries(legacyCampaigns) as [string, { clicks: number; sales: number; commission: number }][]) {
            campaignsV3[source] = { clicks: row.clicks || 0, sales: row.sales || 0, refunds: 0, grossCommission: row.commission || 0, netCommission: row.commission || 0 };
          }
          await ctx.storage.put("metric:campaigns:v3", campaignsV3);
          await ctx.storage.put("metric:offers:v3", { cpm: { clicks: legacyClicks, sales: legacySales, refunds: 0, grossCommission: legacyCommission, netCommission: legacyCommission } });
        }
        await ctx.storage.put("metric:v3:migrated", true);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify(this.getStateMessage()));
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Expected WebSocket", { status: 400 });
  }

  async updateStep(stepName: string, status: string): Promise<void> {
    this.stepStatuses.set(stepName, status);
    if (status === "running" || status === "waiting") this.currentStep = stepName;
    const values = Array.from(this.stepStatuses.values());
    if (values.length > 0 && values.every((s) => s === "completed")) {
      this.workflowStatus = "completed";
      this.currentStep = null;
    }
    await this.ctx.storage.put("stepStatuses", Object.fromEntries(this.stepStatuses));
    await this.ctx.storage.put("currentStep", this.currentStep);
    await this.ctx.storage.put("workflowStatus", this.workflowStatus);
    this.broadcast(this.getStateMessage());
  }

  private async readStats(key: string): Promise<PerformanceStats> {
    return (await this.ctx.storage.get<PerformanceStats>(key)) || blank();
  }

  private async readMap(key: string): Promise<Record<string, PerformanceStats>> {
    return (await this.ctx.storage.get<Record<string, PerformanceStats>>(key)) || {};
  }

  async recordClick(click: ClickRecord) {
    const total = await this.readStats("metric:total");
    const campaigns = await this.readMap("metric:campaigns:v3");
    const offers = await this.readMap("metric:offers:v3");
    const month = monthKey(click.timestamp);
    const monthly = await this.readStats(`metric:month:${month}`);

    campaigns[click.source] ||= blank();
    offers[click.offer] ||= blank();
    total.clicks += 1;
    campaigns[click.source].clicks += 1;
    offers[click.offer].clicks += 1;
    monthly.clicks += 1;

    await this.ctx.storage.put(`click:${click.tid}`, click);
    await this.ctx.storage.put("metric:total", total);
    await this.ctx.storage.put("metric:campaigns:v3", campaigns);
    await this.ctx.storage.put("metric:offers:v3", offers);
    await this.ctx.storage.put(`metric:month:${month}`, monthly);
    return { ok: true };
  }

  async recordSale(input: Omit<SaleRecord, "source" | "offer">) {
    const key = `sale:${input.orderid}`;
    const existing = await this.ctx.storage.get<SaleRecord>(key);
    if (existing) return { duplicate: true, source: existing.source, offer: existing.offer };

    const click = input.tid ? await this.ctx.storage.get<ClickRecord>(`click:${input.tid}`) : undefined;
    const fallback = fallbackAttribution(input.tid || "");
    const source = click?.source || fallback.source;
    const offer = click?.offer || fallback.offer;
    const sale: SaleRecord = { ...input, source, offer };

    const total = await this.readStats("metric:total");
    const campaigns = await this.readMap("metric:campaigns:v3");
    const offers = await this.readMap("metric:offers:v3");
    const month = monthKey(sale.receivedAt);
    const monthly = await this.readStats(`metric:month:${month}`);
    const recent = (await this.ctx.storage.get<SaleRecord[]>("metric:recentSales:v3")) || [];

    campaigns[source] ||= blank();
    offers[offer] ||= blank();
    for (const target of [total, campaigns[source], offers[offer], monthly]) {
      target.sales += 1;
      target.grossCommission += sale.amount;
      target.netCommission += sale.amount;
    }

    await this.ctx.storage.put(key, sale);
    await this.ctx.storage.put("metric:total", total);
    await this.ctx.storage.put("metric:campaigns:v3", campaigns);
    await this.ctx.storage.put("metric:offers:v3", offers);
    await this.ctx.storage.put(`metric:month:${month}`, monthly);
    await this.ctx.storage.put("metric:recentSales:v3", [sale, ...recent].slice(0, 50));
    return { duplicate: false, source, offer };
  }

  async recordRefund(refund: RefundInput) {
    const refundKey = `refund:${refund.orderid}`;
    if (await this.ctx.storage.get(refundKey)) return { duplicate: true };

    const saleKey = `sale:${refund.orderid}`;
    const sale = await this.ctx.storage.get<SaleRecord>(saleKey);
    if (!sale) {
      await this.ctx.storage.put(refundKey, { ...refund, unmatched: true });
      return { duplicate: false, matched: false };
    }

    const alreadyRefunded = sale.refundedAmount || 0;
    const remaining = Math.max(0, sale.amount - alreadyRefunded);
    const requested = refund.amount > 0 ? refund.amount : remaining;
    const applied = Math.min(remaining, requested);
    if (applied <= 0) {
      await this.ctx.storage.put(refundKey, { ...refund, matched: true, applied: 0 });
      return { duplicate: false, matched: true, applied: 0 };
    }

    const total = await this.readStats("metric:total");
    const campaigns = await this.readMap("metric:campaigns:v3");
    const offers = await this.readMap("metric:offers:v3");
    const month = monthKey(refund.receivedAt);
    const monthly = await this.readStats(`metric:month:${month}`);
    campaigns[sale.source] ||= blank();
    offers[sale.offer] ||= blank();

    for (const target of [total, campaigns[sale.source], offers[sale.offer], monthly]) {
      target.refunds += 1;
      target.netCommission -= applied;
    }

    sale.refundedAmount = alreadyRefunded + applied;
    sale.refundedAt = refund.receivedAt;
    await this.ctx.storage.put(saleKey, sale);
    await this.ctx.storage.put(refundKey, { ...refund, matched: true, applied });
    await this.ctx.storage.put("metric:total", total);
    await this.ctx.storage.put("metric:campaigns:v3", campaigns);
    await this.ctx.storage.put("metric:offers:v3", offers);
    await this.ctx.storage.put(`metric:month:${month}`, monthly);
    return { duplicate: false, matched: true, applied: roundMoney(applied) };
  }

  async getStats() {
    const total = await this.readStats("metric:total");
    const campaigns = await this.readMap("metric:campaigns:v3");
    const offers = await this.readMap("metric:offers:v3");
    const currentMonthKey = monthKey();
    const currentMonth = await this.readStats(`metric:month:${currentMonthKey}`);
    const recentSales = (await this.ctx.storage.get<SaleRecord[]>("metric:recentSales:v3")) || [];

    const normalize = (stats: PerformanceStats) => ({
      ...stats,
      grossCommission: roundMoney(stats.grossCommission),
      netCommission: roundMoney(stats.netCommission),
      conversionRate: stats.clicks > 0 ? Math.round((stats.sales / stats.clicks) * 10000) / 100 : 0,
      epc: stats.clicks > 0 ? roundMoney(stats.netCommission / stats.clicks) : 0,
    });

    return {
      ...normalize(total),
      campaigns: Object.fromEntries(Object.entries(campaigns).map(([k, v]) => [k, normalize(v)])),
      offers: Object.fromEntries(Object.entries(offers).map(([k, v]) => [k, normalize(v)])),
      currentMonth: { key: currentMonthKey, ...normalize(currentMonth) },
      recentSales: recentSales.map((sale) => ({
        orderid: sale.orderid,
        amount: sale.amount,
        seller: sale.seller,
        tid: sale.tid,
        source: sale.source,
        offer: sale.offer,
        country: sale.country,
        saletimestamp: sale.saletimestamp,
        receivedAt: sale.receivedAt,
        refundedAmount: sale.refundedAmount || 0,
      })),
      updatedAt: Date.now(),
    };
  }

  async webSocketMessage(ws: WebSocket, _message: string): Promise<void> {
    ws.send(JSON.stringify(this.getStateMessage()));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }

  private broadcast(message: object): void {
    const json = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(json); } catch { /* disconnected */ }
    }
  }

  private getStateMessage(): object {
    return {
      type: "workflow_update",
      currentStep: this.currentStep,
      stepStatuses: Object.fromEntries(this.stepStatuses),
      workflowStatus: this.workflowStatus,
      timestamp: Date.now(),
    };
  }
}
