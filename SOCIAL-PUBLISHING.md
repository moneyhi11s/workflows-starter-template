# Moneyhi11s Social Publishing Setup

## Goal

Publish buyer-first review/comparison content from owned Moneyhi11s social accounts, using a unique tracking source for each post. Do not use unsolicited bulk DMs, fake engagement, purchased followers, misleading earnings claims, or automatic posting into groups/communities that prohibit promotion.

## Content source

The Worker exposes a platform-ready queue at:

`/api/content`

Each item includes:

- platform
- hook
- offer
- unique source ID
- buyer-check landing URL
- direct tracked URL
- affiliate disclosure
- CTA

Use the buyer-check landing URL for social traffic unless a platform or campaign specifically needs a direct tracked link.

## TikTok

Official Direct Post requires a registered TikTok developer app, Content Posting API enabled, approval for `video.publish`, and authorization by the target TikTok account. Unaudited posting clients are restricted to private visibility, so do not treat an unaudited API integration as a public traffic source.

Store credentials only as secrets, never in the repo. Suggested secret names:

- `TIKTOK_ACCESS_TOKEN`
- `TIKTOK_OPEN_ID`

Affiliate/commercial posts should use TikTok's content disclosure setting.

## Instagram

Programmatic publishing requires an Instagram professional account and the appropriate Instagram content publishing permissions/access token. Store only secret references in automation. Suggested secret names:

- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`

Publish Reels/posts from original media hosted on a public server and include a clear affiliate disclosure in the caption.

## YouTube

YouTube Data API uploads require OAuth authorization with a YouTube upload scope. New/unverified API projects can have API-uploaded videos restricted to private until the project completes Google's audit.

Suggested secret names:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

Use YouTube's paid-promotion disclosure when a commercial relationship requires it and include a plain-language affiliate disclosure near the tracked link.

## Search / website traffic

The Worker serves:

- `/compare`
- `/reviews/copy-paste-millionaire`
- `/reviews/aica-247`
- `/reviews/profit-loop`
- `/sitemap.xml`
- `/robots.txt`
- `/feed.xml`

Affiliate links use sponsored/nofollow qualification on buyer-facing SEO pages.

## Measurement rule

Every post must have a distinct `src` value. Scale only from confirmed sales and positive net EPC after refunds; do not scale based on raw views or clicks alone.
