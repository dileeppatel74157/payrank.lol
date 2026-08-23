import { legalStyles } from '@/lib/legalStyles';

export const metadata = { title: 'Privacy Policy — PayRank' };

export default function PrivacyPage() {
  return (
    <main className="legalWrap">
      <style dangerouslySetInnerHTML={{ __html: legalStyles }} />
      <a className="backLink" href="/">← Back to the board</a>
      <h1>Privacy Policy</h1>
      <p className="legalMeta">Last updated: August 2026</p>

      <h2>1. What we collect</h2>
      <ul>
        <li>The URL or handle, display name, and category you submit for a listing.</li>
        <li>The bid amount and payment method (Razorpay or crypto).</li>
        <li>
          For card/UPI payments: your payment is handled directly by Razorpay. We receive a
          payment confirmation and the notes attached to the order (your listing details) — we do
          not receive or store your full card number.
        </li>
        <li>For crypto payments: the wallet transaction hash you submit for verification.</li>
        <li>Click counts on your listing, for the numbers shown on the board.</li>
      </ul>

      <h2>2. What we don't collect</h2>
      <p>
        There are no user accounts, no passwords, and no tracking of who clicks a listing beyond
        an anonymous total count.
      </p>

      <h2>3. How we use it</h2>
      <p>
        Solely to run the leaderboard: to display your listing, calculate your rank, verify
        payment, and route clicks to the URL you submitted.
      </p>

      <h2>4. Third parties</h2>
      <p>
        Razorpay processes card and UPI payments under its own privacy policy. Supabase hosts our
        database. We don't sell or share your data beyond what's needed to run those services.
      </p>

      <h2>5. Public information</h2>
      <p>
        Your listing — URL, display name, category, and bid amount — is public by design; that's
        the entire point of the board. Don't submit anything you don't want publicly visible.
      </p>

      <h2>6. Data retention</h2>
      <p>
        Listing and bid records are kept for as long as the board is running, for auditing and
        dispute resolution.
      </p>

      <h2>7. Contact</h2>
      <p>
        For questions about this policy or to request removal of a listing, email us at{' '}
        <a href="mailto:payrank.info@gmail.com">payrank.info@gmail.com</a>.
      </p>
    </main>
  );
}
