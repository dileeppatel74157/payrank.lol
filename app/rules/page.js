import { legalStyles } from '@/lib/legalStyles';

export const metadata = { title: 'Rules — PayRank' };

export default function RulesPage() {
  return (
    <main className="legalWrap">
      <style dangerouslySetInnerHTML={{ __html: legalStyles }} />
      <a className="backLink" href="/">← Back to the board</a>
      <h1>Rules</h1>
      <p className="legalMeta">Last updated: August 2026</p>

      <h2>1. How ranking works</h2>
      <p>
        Rank is decided entirely by lifetime amount paid for a listing. The listing with the
        highest total sits at #1. To take a rank, you must pay more than the current holder of
        that rank has paid in total.
      </p>

      <h2>2. Minimum bid</h2>
      <p>The minimum bid to appear on the board is $1. There is no maximum.</p>

      <h2>3. Bids are permanent</h2>
      <p>
        Money paid is never refunded, and it never expires — including if you are later outbid
        and pushed down the board. Your listing keeps whatever rank your lifetime total can hold.
      </p>

      <h2>4. What you can list</h2>
      <ul>
        <li>A public website or product URL.</li>
        <li>A public X (Twitter) handle or other public social profile.</li>
      </ul>

      <h2>5. What is not allowed</h2>
      <ul>
        <li>Chat or invite links — Telegram, WhatsApp, Discord, Signal, or similar.</li>
        <li>Sexual, adult, or NSFW content of any kind.</li>
        <li>Anything illegal to advertise in your jurisdiction or ours.</li>
        <li>Link shorteners — submit the real destination URL.</li>
      </ul>
      <p>
        Tracking and affiliate query parameters are stripped from submitted links automatically.
      </p>

      <h2>6. Removal</h2>
      <p>
        We can remove a listing that breaks these rules at any time, without a refund. If your
        listing is removed and you believe it was a mistake, contact us and we'll take a look.
      </p>

      <h2>7. No guarantee of results</h2>
      <p>
        A rank on this board is a placement, not a promise. We do not guarantee any specific
        amount of traffic, clicks, or outcome from being listed.
      </p>
    </main>
  );
}

export function generateStaticParams() {
  return [];
}
