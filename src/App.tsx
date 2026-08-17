import { useCallback, useEffect, useMemo, useState } from "react";

const OFFERS = {
  cpm: {
    name: "Copy Paste Millionaire",
    note: "Current primary test offer.",
    snapshot: { price: 97, commission: "75% RevShare", refundRate: 11.38, avgSale: 34.41 },
  },
  aica: {
    name: "AICA-247",
    note: "Lower-price challenger with the lowest refund rate in our captured marketplace snapshot.",
    snapshot: { price: 47, commission: "50% RevShare", refundRate: 9.52, avgSale: 33.84 },
  },
  profitloop: {
    name: "Profit Loop",
    note: "Challenger offer; current captured refund rate is higher than the other two.",
    snapshot: { price: 47, commission: "50% RevShare", refundRate: 14.14, avgSale: 28.86 },
  },
} as const;

type OfferKey = keyof typeof OFFERS;
type Perf = {
  clicks: number;
  sales: number;
  refunds: number;
  grossCommission: number;
  netCommission: number;
  conversionRate: number;
  epc: number;
};
type Sale = {
  orderid: string;
  amount: number;
  seller: string;
  source: string;
  offer: string;
  country: string;
  refundedAmount: number;
};
type Stats = Perf & {
  campaigns: Record<string, Perf>;
  offers: Record<string, Perf>;
  currentMonth: Perf & { key: string };
  recentSales: Sale[];
  updatedAt: number;
};

const emptyPerf: Perf = {
  clicks: 0,
  sales: 0,
  refunds: 0,
  grossCommission: 0,
  netCommission: 0,
  conversionRate: 0,
  epc: 0,
};
const emptyStats: Stats = {
  ...emptyPerf,
  campaigns: {},
  offers: {},
  currentMonth: { key: "", ...emptyPerf },
  recentSales: [],
  updatedAt: 0,
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function cleanSource(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "direct";
}

function selectedOffer(): OfferKey {
  const value = new URLSearchParams(window.location.search).get("offer") as OfferKey | null;
  return value && value in OFFERS ? value : "cpm";
}

function selectedSource() {
  return cleanSource(new URLSearchParams(window.location.search).get("src") || "presell");
}

function OfferPage() {
  const offer = selectedOffer();
  const source = selectedSource();
  const info = OFFERS[offer];
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-20">
        <a href="/compare" className="text-sm font-bold text-emerald-300">← Compare offers</a>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Moneyhi11s Buyer Check</p>
        <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">Thinking about {info.name}? Check the basics first.</h1>
        <p className="mt-6 text-lg leading-8 text-slate-300">
          This is a third-party digital product. We do not promise income. Use this page to check what you are buying, the total cost, support, and refund terms before deciding.
        </p>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <h2 className="text-2xl font-black">60-second buyer check</h2>
          <ul className="mt-5 space-y-3 text-slate-300">
            <li>• What training, software, templates, or support are actually included?</li>
            <li>• What is the full checkout price, including optional upsells?</li>
            <li>• What does the refund policy actually say?</li>
            <li>• Is this useful even if it produces no specific earnings result?</li>
            <li>• Can you realistically put in the time and effort the method requires?</li>
          </ul>
          <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-50">
            Treat vendor earnings language as marketing. Verify the product, price, refund policy, and any recurring charges on the official page before purchasing.
          </div>
          <a
            href={`/go/${offer}?src=${encodeURIComponent(source)}`}
            rel="sponsored"
            className="mt-7 inline-flex rounded-xl bg-emerald-400 px-6 py-3 font-extrabold text-slate-950 hover:bg-emerald-300"
          >
            View official offer →
          </a>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            Affiliate disclosure: Moneyhi11s may earn a commission if you purchase through this link, at no additional cost to you.
          </p>
        </section>
      </div>
    </main>
  );
}

function ComparePage() {
  const source = selectedSource();
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 md:py-20">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Moneyhi11s</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">Compare before you buy.</h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">We are testing multiple legitimate affiliate offers with separate tracking. Price, terms, commissions and vendor pages can change, so verify the current details before purchasing.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {(Object.entries(OFFERS) as [OfferKey, (typeof OFFERS)[OfferKey]][]).map(([key, offer]) => (
            <article key={key} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-black">{offer.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{offer.note}</p>
              <dl className="mt-5 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between gap-4"><dt>Price snapshot</dt><dd className="font-bold">{money(offer.snapshot.price)}</dd></div>
                <div className="flex justify-between gap-4"><dt>Affiliate payout</dt><dd className="font-bold">{offer.snapshot.commission}</dd></div>
                <div className="flex justify-between gap-4"><dt>Avg./sale snapshot</dt><dd className="font-bold">{money(offer.snapshot.avgSale)}</dd></div>
                <div className="flex justify-between gap-4"><dt>Refund-rate snapshot</dt><dd className="font-bold">{offer.snapshot.refundRate.toFixed(2)}%</dd></div>
              </dl>
              <a className="mt-6 inline-flex rounded-xl border border-white/15 px-4 py-3 font-bold hover:bg-white/5" href={`/offer?offer=${key}&src=${encodeURIComponent(source)}`}>Buyer check →</a>
            </article>
          ))}
        </div>
        <p className="mt-8 text-xs leading-5 text-slate-500">Marketplace figures are a Moneyhi11s snapshot captured from Explodely in August 2026 and can change. Verify current price, payout, refund policy, and terms on the official vendor/checkout page. Moneyhi11s may receive affiliate commissions from qualifying purchases. No income result is guaranteed.</p>
      </div>
    </main>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("youtube-review-01");
  const [offer, setOffer] = useState<OfferKey>("cpm");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) throw new Error("stats unavailable");
      setStats(await response.json());
      setError("");
    } catch {
      setError("Live stats are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const campaignRows = useMemo(
    () => (Object.entries(stats.campaigns) as [string, Perf][]).sort((a, b) => b[1].epc - a[1].epc || b[1].netCommission - a[1].netCommission),
    [stats.campaigns],
  );
  const offerRows = useMemo(
    () => (Object.entries(stats.offers) as [string, Perf][]).sort((a, b) => b[1].epc - a[1].epc || b[1].netCommission - a[1].netCommission),
    [stats.offers],
  );
  const sourceSlug = cleanSource(source);
  const origin = window.location.origin;
  const presellLink = `${origin}/offer?offer=${offer}&src=${sourceSlug}`;
  const directLink = `${origin}/go/${offer}?src=${sourceSlug}`;
  const avgNetPerSale = stats.currentMonth.sales > 0 ? stats.currentMonth.netCommission / stats.currentMonth.sales : 0;
  const salesNeeded = avgNetPerSale > 0 ? Math.ceil(Math.max(0, 5000 - stats.currentMonth.netCommission) / avgNetPerSale) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Moneyhi11s v3</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Revenue Engine</h1>
            <p className="mt-2 max-w-2xl text-slate-400">Scale by confirmed net commission and EPC—not views, hype, or fake counters.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/compare" className="rounded-xl border border-white/15 px-4 py-3 font-bold hover:bg-white/5">Compare offers</a>
            <a href="/offer?offer=cpm&src=dashboard" className="rounded-xl bg-emerald-400 px-4 py-3 font-extrabold text-slate-950">Open funnel →</a>
          </div>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-5">
          {[
            ["Lifetime clicks", stats.clicks.toLocaleString()],
            ["Lifetime sales", stats.sales.toLocaleString()],
            ["Refunds", stats.refunds.toLocaleString()],
            ["Net commission", money(stats.netCommission)],
            ["Net EPC", money(stats.epc)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black">{loading ? "…" : value}</p>
            </div>
          ))}
        </section>

        {error && <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">{error}</div>}

        <section className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
          <h2 className="text-xl font-black">$5,000/month control panel</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div><p className="text-xs uppercase text-slate-400">Month</p><p className="mt-1 text-2xl font-black">{stats.currentMonth.key || "—"}</p></div>
            <div><p className="text-xs uppercase text-slate-400">Net commission</p><p className="mt-1 text-2xl font-black">{money(stats.currentMonth.netCommission)}</p></div>
            <div><p className="text-xs uppercase text-slate-400">Monthly EPC</p><p className="mt-1 text-2xl font-black">{money(stats.currentMonth.epc)}</p></div>
            <div><p className="text-xs uppercase text-slate-400">Sales still needed*</p><p className="mt-1 text-2xl font-black">{salesNeeded === null ? "Need sales data" : salesNeeded}</p></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">*Estimate based only on realized net commission per confirmed sale this month. It is not a guarantee.</p>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-black">Campaign link builder</h2>
            <p className="mt-1 text-sm text-slate-400">Give every video/post its own source name so sales identify the actual winner.</p>
            <label className="mt-5 block text-sm font-bold">Offer</label>
            <select value={offer} onChange={(e) => setOffer(e.target.value as OfferKey)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3">
              {(Object.entries(OFFERS) as [OfferKey, (typeof OFFERS)[OfferKey]][]).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
            </select>
            <label className="mt-4 block text-sm font-bold">Source ID</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3" placeholder="youtube-review-01" />
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Recommended public link</p>
            <code className="mt-2 block break-all rounded-xl bg-black/30 p-3 text-xs">{presellLink}</code>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Direct tracked link</p>
            <code className="mt-2 block break-all rounded-xl bg-black/30 p-3 text-xs">{directLink}</code>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-black">Scaling rules</h2>
            <ol className="mt-5 space-y-4 text-sm text-slate-300">
              <li><b className="text-white">1.</b> Publish original review, comparison, demonstration, or problem-solving content.</li>
              <li><b className="text-white">2.</b> Give every post a unique source ID.</li>
              <li><b className="text-white">3.</b> Judge winners by confirmed sales and net EPC.</li>
              <li><b className="text-white">4.</b> Make more variations of winners; stop repeatedly pushing losers.</li>
              <li><b className="text-white">5.</b> Do not buy traffic until a funnel has demonstrated real conversion economics.</li>
              <li><b className="text-white">6.</b> Avoid fake earnings claims, fake engagement, bots, spam, or misleading redirects.</li>
            </ol>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-black">Campaign leaderboard</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400"><tr><th className="pb-3">Source</th><th>Clicks</th><th>Sales</th><th>Refunds</th><th>CVR</th><th>EPC</th><th>Net</th></tr></thead>
              <tbody>{campaignRows.length === 0 ? <tr><td colSpan={7} className="py-6 text-slate-500">No campaign data yet.</td></tr> : campaignRows.map(([key, p]) => <tr key={key} className="border-t border-white/10"><td className="py-3 font-bold">{key}</td><td>{p.clicks}</td><td>{p.sales}</td><td>{p.refunds}</td><td>{p.conversionRate.toFixed(2)}%</td><td>{money(p.epc)}</td><td>{money(p.netCommission)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-black">Offer leaderboard</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400"><tr><th className="pb-3">Offer</th><th>Clicks</th><th>Sales</th><th>Refunds</th><th>CVR</th><th>EPC</th><th>Net</th></tr></thead>
              <tbody>{offerRows.length === 0 ? <tr><td colSpan={7} className="py-6 text-slate-500">No offer data yet.</td></tr> : offerRows.map(([key, p]) => <tr key={key} className="border-t border-white/10"><td className="py-3 font-bold">{OFFERS[key as OfferKey]?.name || key}</td><td>{p.clicks}</td><td>{p.sales}</td><td>{p.refunds}</td><td>{p.conversionRate.toFixed(2)}%</td><td>{money(p.epc)}</td><td>{money(p.netCommission)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-black">Recent confirmed commissions</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400"><tr><th className="pb-3">Order</th><th>Offer</th><th>Source</th><th>Country</th><th>Gross</th><th>Refunded</th></tr></thead>
              <tbody>{stats.recentSales.length === 0 ? <tr><td colSpan={6} className="py-6 text-slate-500">No confirmed affiliate sale notifications received yet.</td></tr> : stats.recentSales.map((sale) => <tr key={sale.orderid} className="border-t border-white/10"><td className="py-3 font-mono text-xs">{sale.orderid}</td><td>{OFFERS[sale.offer as OfferKey]?.name || sale.offer}</td><td>{sale.source}</td><td>{sale.country || "—"}</td><td className="font-bold text-emerald-300">{money(sale.amount)}</td><td>{money(sale.refundedAmount)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <footer className="py-8 text-xs leading-5 text-slate-500">Affiliate marketing involves risk. Revenue is counted only from confirmed Explodely notifications; net figures account for refunds received by the configured refund endpoint.</footer>
      </div>
    </main>
  );
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/offer")) return <OfferPage />;
  if (path.startsWith("/compare")) return <ComparePage />;
  return <Dashboard />;
}
