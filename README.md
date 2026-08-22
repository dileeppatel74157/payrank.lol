# PayRank.lol — setup & launch guide

A lean pay-to-rank leaderboard: bid → climb → get seen. Built with Next.js,
Supabase, Razorpay (cards/UPI), and manual USDT (TRC20) for crypto bids.

## 1. Supabase (5 min)

1. Create a project at supabase.com (free tier is enough to start).
2. Open the SQL editor and run everything in `supabase/schema.sql`.
3. Go to Project Settings → API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server only)

## 2. Razorpay (10–15 min)

1. Sign up at razorpay.com with your PAN/bank details.
2. **International payments are not on by default.** Go to Account & Settings →
   International Payments and request activation — this needs KYC/business
   verification and may take a day or two to approve. Until it's approved you
   can still accept Indian cards + UPI.
3. Dashboard → Settings → API Keys → generate keys → copy into
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Dashboard → Settings → Webhooks → add webhook:
   - URL: `https://yourdomain.com/api/razorpay-webhook`
   - Active events: `payment.captured`
   - Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.

## 3. Crypto (USDT TRC20)

1. Get a Tron wallet address (Trust Wallet, Binance, etc. all work).
2. Put it in `NEXT_PUBLIC_USDT_TRC20_ADDRESS`.
3. This flow is **manual for now**: a bidder submits their tx hash, it's logged
   as `status = 'pending'` in the `bids` table. Check the hash on
   tronscan.org, then in the Supabase table editor:
   - Set that bid's `status` to `confirmed`
   - Add the bid amount to the matching row in `listings.total_bid`
   This takes 30 seconds per bid and avoids building blockchain-verification
   code for a side project. Automate later only if crypto volume justifies it.

## 4. Deploy (Vercel, ~5 min)

1. Push this folder to a GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. Add all variables from `.env.example` in Vercel's Environment Variables
   settings (use your real values, not the placeholders).
4. Deploy. Then in Vercel → Domains, add `payrank.lol` and point your
   registrar's DNS at Vercel per their instructions.
5. Re-check the Razorpay webhook URL once your real domain is live.

## 5. Legal pages

`/rules`, `/terms`, and `/privacy` are already built and linked in the footer.
Before going live, update:
- The contact method mentioned on the homepage/footer (add a real email or X
  handle — currently the pages just say "the contact listed on the homepage,"
  so add one to `app/page.js`).
- Confirm the no-refund and bid-permanence language matches how you actually
  want to run it before real money starts moving.
- If you register a company later, swap "we/us" for the entity name.

These are a solid starting point, not a substitute for a lawyer if this grows
beyond a side project.

## Notes on scope

- This is intentionally lean: one leaderboard, one bid flow, two payment
  rails. No accounts, no categories page, no admin dashboard — the Supabase
  table editor *is* your admin panel for now.
- Rules worth copying from the original wave: strip tracking params from
  submitted URLs, block chat/invite links (Telegram/WhatsApp/Discord) and
  adult content, and require a minimum bid (this build defaults to $1,
  adjust the `min="1"` checks in `app/page.js` if you want a higher floor).
- Treat this as a short-lived experiment, not infrastructure — the whole
  category is a novelty auction and interest fades fast once a niche is this
  crowded. Bank whatever it earns and roll it into your longer-term work.
