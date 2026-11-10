# Study pack maker: Vercel version

Folder layout: `public/` is the app, `api/` is the server, `lib/shared.js` holds shared helpers.

## What the server does
- **AI** (`api/ai.js`): your app talks to Claude through your own Anthropic key. Nobody can use it without a valid "pack ticket".
- **Daily limits** (`api/pack-start.js`): Basic 5, Pro 10, Plus 20, counted on the server (resets at midnight UTC). A started pack counts.
- **Payments** (`api/checkout.js`, `api/plan.js`, `api/portal.js`): Stripe Checkout; the plan comes from Stripe, not from the browser.
- **Voice file import** (`api/transcribe.js`): Whisper, Pro and Plus. Recordings up to about 4 MB.
- **Video links** (`api/video.js`): YouTube captions, Plus only.
- **Owner** (`OWNER_KEY`): you sign in once with your private key (Subscription page, "Owner sign-in") and get everything, unlimited.

## Setup (about 30 minutes)
1. Accounts: Vercel, Anthropic (console.anthropic.com), OpenAI (platform.openai.com), Stripe.
2. Stripe dashboard: create two products with monthly prices, Pro $7 and Plus $12. Copy each `price_...` id. Turn on the customer portal (Settings > Billing > Customer portal). Add your bank account under Settings > Business > Bank accounts. Start in **test mode**.
3. Put this folder on GitHub and import it in Vercel (or run `npm i -g vercel` then `vercel` in this folder).
4. In Vercel > Storage (or Marketplace), add **Upstash Redis** to the project. It adds the `UPSTASH_REDIS_*` variables for you.
5. Vercel > Settings > Environment Variables: add everything in `.env.example` (make up `APP_SECRET` and `OWNER_KEY` yourself).
6. Redeploy. Open your site, buy Pro with Stripe's test card `4242 4242 4242 4242`, and check the plan changes.
7. When happy: switch Stripe to live mode, replace `STRIPE_SECRET_KEY` and the two price ids with live ones, redeploy.

## Things to know
- Vercel's free Hobby plan is for non-commercial use. Charging customers needs Vercel Pro.
- Request bodies are limited to about 4.5 MB on Vercel, so long recordings are refused. A later upgrade (Vercel Blob uploads) can lift this.
- YouTube sometimes blocks requests from data-centre servers, so some links may fail. Only YouTube links with captions work. Other sites are not supported.
- Voice and video text are added to the notes box; the new button labels exist in English only (other languages show English for them).
- Nobody has tested this against your live accounts. Test mode first.
