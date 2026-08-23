import { legalStyles } from '@/lib/legalStyles';

export const metadata = { title: 'Terms of Service — PayRank' };

export default function TermsPage() {
  return (
    <main className="legalWrap">
      <style dangerouslySetInnerHTML={{ __html: legalStyles }} />
      <a className="backLink" href="/">← Back to the board</a>
      <h1>Terms of Service</h1>
      <p className="legalMeta">Last updated: August 2026</p>

      <h2>1. What PayRank is</h2>
      <p>
        PayRank is a public, paid leaderboard. Anyone can submit a URL or public handle and pay
        an amount of their choosing to be listed. Rank is determined solely by lifetime amount
        paid — see the <a href="/rules">Rules</a> page for the mechanics.
      </p>

      <h2>2. Payment</h2>
      <p>
        Card and UPI payments are processed by Razorpay. Crypto payments (USDT, TRC20 network)
        are sent directly to a published wallet address and confirmed manually before your rank
        updates. By submitting a bid, you agree to pay the amount you enter.
      </p>

      <h2>3. No refunds</h2>
      <p>
        All payments are final. This applies whether you are outbid, your listing is removed for
        breaking the <a href="/rules">Rules</a>, or you simply change your mind. There are no
        exceptions.
      </p>

      <h2>4. No affiliation and no endorsement</h2>
      <p>
        A listing on PayRank is not an endorsement, review, or verification of the linked
        product, company, or account by PayRank. We do not check whether listed products work as
        described, and placement does not imply we recommend them.
      </p>

      <h2>5. Your responsibility for what you submit</h2>
      <p>
        You are responsible for the accuracy of anything you submit and for making sure the
        linked destination is one you have the right to advertise. Do not submit URLs or handles
        you don't control or don't have permission to promote.
      </p>

      <h2>6. Service availability</h2>
      <p>
        PayRank is an experimental, independently run project. It may change, be interrupted, or
        be discontinued at any time. We'll try to give notice before shutting the board down, but
        we don't guarantee it.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        PayRank is provided as-is. To the extent permitted by law, we are not liable for any
        indirect, incidental, or consequential loss arising from your use of the site, including
        loss of expected traffic or business outcomes.
      </p>

      <h2>8. Changes to these terms</h2>
      <p>
        We may update these terms as the project evolves. Continued use of the site after a
        change means you accept the updated terms.
      </p>

      <h2>9. Contact</h2>
      <p>Questions about these terms can be sent to <a href="mailto:payrank.info@gmail.com">payrank.info@gmail.com</a>.</p>
    </main>
  );
}
