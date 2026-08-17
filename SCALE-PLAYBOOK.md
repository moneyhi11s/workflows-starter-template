# Moneyhi11s v3 Scale Playbook

## What v3 changes

- Tracks three current Explodely offers from one Worker.
- Tracks each traffic source independently.
- Uses the exact click `tid` to attribute confirmed sales whenever possible.
- Adds lifetime and current-month net commission, EPC, refunds, campaign ranking, and offer ranking.
- Adds `/compare` and per-offer buyer-check pages.
- Adds an optional refund listener at `/api/explodely/refund?key=YOUR_SECRET`.
- Avoids needing to manually edit `worker-configuration.d.ts` for `ISN_SECRET`.

## Funnel

Original short-form/search content -> `/offer?offer=cpm&src=UNIQUE-ID` -> `/go/cpm?src=UNIQUE-ID` -> Explodely -> confirmed Sale ISN -> dashboard.

Use a unique source ID for every piece of content, for example:

- `youtube-review-01`
- `youtube-comparison-02`
- `tiktok-demo-01`
- `instagram-review-03`

Repurpose the same original concept across platforms, but keep the source IDs separate.

## Content model

Build content around four repeatable formats:

1. Review: what the product is, what you actually receive, what to verify before buying.
2. Comparison: compare alternatives without inventing claims or results.
3. Demonstration: show a real workflow or feature when you have access to it.
4. Problem/solution: teach something useful first, then offer the relevant buyer-check link.

Use a strong opening hook and a clear CTA, but do not use fake earnings, fake testimonials, fake scarcity, bots, purchased engagement, spam, or misleading redirects.

## Scaling rule

Do not scale based on views alone. Scale only after real data shows a campaign or offer producing confirmed sales and positive net EPC. If paid traffic is added later, compare net EPC to actual cost per click/acquisition and cap losses during tests.

## Explodely settings

Sale listener:

`https://YOUR-DOMAIN/api/explodely/isn?key=YOUR_SECRET`

Optional refund listener if your Explodely affiliate account exposes a refund URL:

`https://YOUR-DOMAIN/api/explodely/refund?key=YOUR_SECRET`

Use the same Cloudflare `ISN_SECRET` in both URLs. Do not publish the secret.
