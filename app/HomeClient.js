'use client';

import { useEffect, useState } from 'react';
import { supabasePublic } from '@/lib/supabase';

function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || 'ADD_YOUR_TRC20_ADDRESS';

export default function HomeClient({ initialListings = [], initialRecentBidsCount = 0 }) {
  const [listings, setListings] = useState(initialListings);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState('form'); // form | crypto | done
  const [form, setForm] = useState({ url: '', displayName: '', category: 'other', amount: 10 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [recentBidsCount, setRecentBidsCount] = useState(initialRecentBidsCount);

  async function loadListings(cat = activeCategory) {
    let query = supabasePublic
      .from('listings')
      .select('id, url, display_name, category, total_bid, clicks, created_at')
      .order('total_bid', { ascending: false })
      .limit(50);

    if (cat !== 'all') {
      query = query.eq('category', cat.toLowerCase());
    }

    const { data } = await query;
    setListings(data || []);
    setLoading(false);
  }

  async function loadRecentActivity() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { count, error } = await supabasePublic
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('created_at', yesterday);

      if (!error && count !== null) {
        setRecentBidsCount(count);
      } else {
        setRecentBidsCount(0);
      }
    } catch (e) {
      setRecentBidsCount(0);
    }
  }

  useEffect(() => {
    // Only query on mount/change in activeCategory, keeping SSR data fresh
    loadListings(activeCategory);
    loadRecentActivity();

    const interval = setInterval(() => {
      loadListings(activeCategory);
      loadRecentActivity();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeCategory]);

  const topBid = listings[0]?.total_bid || 0;
  const priceToBeatNumber1 = Math.floor(topBid) + 1;

  function openModal() {
    // Pre-fill the bid to the actual minimum amount needed to claim or outbid #1
    const defaultAmount = priceToBeatNumber1 > 0 ? priceToBeatNumber1 : 2;
    setForm({ url: '', displayName: '', category: 'other', amount: defaultAmount });
    setStep('form');
    setError('');
    setTxHash('');
    setModalOpen(true);
  }

  async function payWithRazorpay() {
    setError('');
    if (!form.url || !form.amount || form.amount < 1) {
      setError('Enter a URL and an amount of at least $1.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUSD: Number(form.amount),
          url: form.url,
          displayName: form.displayName,
          category: form.category,
          referralCode: getCookie('_fprom_ref') || '',
          trackingId: getCookie('_fprom_tid') || '',
        }),
      });
      const order = await res.json();
      if (order.error) throw new Error(order.error);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'PayRank',
          description: `Bid for ${form.displayName || form.url}`,
          handler: function () {
            setStep('done');
            setTimeout(loadListings, 3000);
          },
          theme: { color: '#12213A' },
        });
        rzp.open();
        setBusy(false);
      };
      document.body.appendChild(script);
    } catch (e) {
      setError(e.message || 'Something went wrong starting the payment.');
      setBusy(false);
    }
  }

  function goToCrypto() {
    if (!form.url || !form.amount || form.amount < 1) {
      setError('Enter a URL and an amount of at least $1.');
      return;
    }
    setError('');
    setStep('crypto');
  }

  async function submitCryptoBid() {
    if (!txHash) {
      setError('Paste the transaction hash so we can verify it.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/crypto-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUSD: Number(form.amount),
          url: form.url,
          displayName: form.displayName,
          category: form.category,
          txHash,
          referralCode: getCookie('_fprom_ref') || '',
          trackingId: getCookie('_fprom_tid') || '',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStep('done');
    } catch (e) {
      setError(e.message || 'Could not submit the bid.');
    } finally {
      setBusy(false);
    }
  }

  const topListing = listings[0];

  return (
    <main className="wrap">
      <header className="hero">
        <div className="logoContainer">
          <a href="/" className="logoLink" aria-label="PayRank.LOL Home">
            <picture>
              <source media="(max-width: 480px)" srcSet="/logo/payrank-icon.png" />
              <img src="/logo/payrank-horizontal.png" alt="PayRank.LOL" className="logoImg" />
            </picture>
          </a>
        </div>
        <p className="eyebrow">NO ALGORITHM · NO VOTES · JUST THE PRICE</p>
        <p className="sub">
          Every rank on this board was bought. Pay more than #1 and the top spot is yours —
          nothing is ever refunded, and no one is ever pushed off for free.
        </p>
        <div className="stampRow">
          <div className="stamp">
            <span className="stampLabel">Price to beat #1</span>
            <span className="stampAmount">${priceToBeatNumber1.toLocaleString()}</span>
          </div>
          <button className="claimBtn" onClick={openModal}>Claim a rank →</button>
        </div>
      </header>

      <section className="howItWorks">
        <div className="step">
          <span className="stepNum">01</span>
          <h3>Submit your link</h3>
          <p>Any website, product, or social handle.</p>
        </div>
        <div className="step">
          <span className="stepNum">02</span>
          <h3>Name your price</h3>
          <p>Pay by card, UPI, or USDT.</p>
        </div>
        <div className="step">
          <span className="stepNum">03</span>
          <h3>Outbid to stay on top</h3>
          <p>Rank is just the highest lifetime bid, nothing else.</p>
        </div>
      </section>

      {/* Visually Dominant #1 Spotlight Card */}
      {topListing ? (
        <div className="spotlightCard">
          <div className="spotlightBadge">👑 CURRENT #1</div>
          <div className="spotlightMain">
            <div className="spotlightInfo">
              <a href={`/go/${topListing.id}`} className="spotlightName">
                {topListing.display_name}
              </a>
              <span className="spotlightUrl">
                {topListing.url.replace(/^https?:\/\//, '')}
              </span>
            </div>
            <div className="spotlightBid">
              <span className="spotlightBidLabel">TOTAL BID</span>
              <span className="spotlightBidAmount">
                ${Number(topListing.total_bid).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="spotlightFooter">
            <span className="spotlightBeatText">
              Beat ${Number(topListing.total_bid).toLocaleString()} to take #1
            </span>
            <button className="outbidBtn" onClick={openModal}>
              OUTBID #1
            </button>
          </div>
        </div>
      ) : (
        <div className="spotlightCard emptySpotlight">
          <div className="spotlightBadge">👑 CLAIM #1</div>
          <div className="spotlightMain">
            <div className="spotlightInfo">
              <span className="spotlightName">The top spot is waiting for you</span>
              <span className="spotlightUrl">yourproduct.com</span>
            </div>
            <div className="spotlightBid">
              <span className="spotlightBidLabel">MINIMUM BID</span>
              <span className="spotlightBidAmount">${priceToBeatNumber1}</span>
            </div>
          </div>
          <div className="spotlightFooter">
            <span className="spotlightBeatText">Only $1 to start the board</span>
            <button className="outbidBtn" onClick={openModal}>
              CLAIM #1
            </button>
          </div>
        </div>
      )}

      {/* Explicit Value Proposition Section */}
      <section className="benefitsSection">
        <h3 className="benefitsTitle">Why bid on PayRank?</h3>
        <p className="benefitsSubtitle">
          Put your startup, product, portfolio, or social profile in front of everyone browsing the board. The higher you bid, the higher you rank.
        </p>
        <div className="benefitsGrid">
          <div className="benefitCard">
            <span className="benefitIcon">👀</span>
            <h4>Visibility</h4>
            <p>Your listing appears publicly on the PayRank board.</p>
          </div>
          <div className="benefitCard">
            <span className="benefitIcon">🔗</span>
            <h4>Clickable Exposure</h4>
            <p>Visitors can click through to your submitted website/profile.</p>
          </div>
          <div className="benefitCard">
            <span className="benefitIcon">🏆</span>
            <h4>Competitive Ranking</h4>
            <p>Higher bids move your listing higher on the board.</p>
          </div>
          <div className="benefitCard">
            <span className="benefitIcon">♾️</span>
            <h4>Lifetime Bid</h4>
            <p>The bid remains attached to the listing even if another bidder later moves ahead.</p>
          </div>
        </div>
      </section>

      <div className="tabs">
        {['All', 'Tools', 'AI', 'Crypto', 'Apps', 'Other'].map((cat) => (
          <button
            key={cat}
            className={`tab ${activeCategory === cat.toLowerCase() ? 'active' : ''}`}
            onClick={() => {
              if (activeCategory !== cat.toLowerCase()) {
                setActiveCategory(cat.toLowerCase());
                setLoading(true);
              }
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {recentBidsCount > 0 && (
        <div className="activityTicker">
          <span>🔥 {recentBidsCount} new {recentBidsCount === 1 ? 'bid' : 'bids'} in the last 24 hours</span>
        </div>
      )}

      <section className="ledger">
        <div className="ledgerHead">
          <span>Rank</span>
          <span>Listing</span>
          <span>Paid</span>
          <span>Clicks</span>
        </div>

        {loading && <p className="empty">Loading the board…</p>}
        
        {!loading && listings.length === 0 && (
          <div className="emptyState">
            <span className="emptyTitle">👑 #1 is available — start the first bid.</span>
            <p className="emptyText">
              Be the first to claim #1. Put your startup, product, portfolio, or social profile in front of everyone browsing the board.
            </p>
            <button className="claimBtn" onClick={openModal}>
              Claim #1 for $1 →
            </button>
          </div>
        )}

        {!loading && listings.map((item, i) => (
          <a key={item.id} className="row" href={`/go/${item.id}`}>
            <span className="rankNum">{String(i + 1).padStart(2, '0')}</span>
            <span className="rowMain">
              <span className="rowName">{item.display_name}</span>
              <span className="rowUrl">{item.url.replace(/^https?:\/\//, '')}</span>
            </span>
            <span className="rowAmount">${Number(item.total_bid).toLocaleString()}</span>
            <span className="rowClicks">{item.clicks}</span>
          </a>
        ))}
      </section>

      <footer className="foot">
        <p>Bids never expire and never refund. Once you're #1, someone can always pay more.</p>
        <p className="footLinks">
          <a href="/rules">Rules</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
        </p>
        <p className="footLinks">
          <a href="https://x.com/payranklol" target="_blank" rel="noopener noreferrer">X</a> · <a href="https://www.instagram.com/payrank.lol" target="_blank" rel="noopener noreferrer">Instagram</a> · <a href="mailto:payrank.info@gmail.com">Email</a>
        </p>
      </footer>

      {modalOpen && (
        <div className="overlay" onClick={() => !busy && setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="closeBtn" onClick={() => setModalOpen(false)}>×</button>

            {step === 'form' && (
              <>
                <h2>Claim your rank</h2>
                <label>Website URL or @handle</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="yoursite.com or @yourhandle"
                />
                <label>Display name (optional)</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="What should the board call you?"
                />
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="tools">Tools</option>
                  <option value="ai">AI</option>
                  <option value="crypto">Crypto</option>
                  <option value="apps">Apps</option>
                  <option value="other">Other</option>
                </select>
                <label>Bid amount (USD)</label>
                <input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />

                {/* Explicit outbid / no-refund disclosure */}
                <div className="disclosureBox">
                  <p>⚠️ Important bidding rules:</p>
                  <ul>
                    <li>Think you're #1? Someone can always outbid you.</li>
                    <li>Your bid is non-refundable even if another bidder takes your position.</li>
                  </ul>
                </div>

                {error && <p className="err">{error}</p>}
                <div className="payRow">
                  <button className="payBtn primary" disabled={busy} onClick={payWithRazorpay}>
                    {busy ? 'Opening checkout…' : 'Pay with card / UPI'}
                  </button>
                  <button className="payBtn" disabled={busy} onClick={goToCrypto}>
                    Pay with USDT
                  </button>
                </div>
              </>
            )}

            {step === 'crypto' && (
              <>
                <h2>Pay with USDT (TRC20)</h2>
                <p className="cryptoNote">
                  Send exactly <strong>${Number(form.amount).toLocaleString()} USDT</strong> to the address below,
                  then paste the transaction hash. Your rank updates once we verify it on-chain.
                </p>
                <div className="addressBox">{USDT_ADDRESS}</div>
                <label>Transaction hash</label>
                <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x… or T…" />
                {error && <p className="err">{error}</p>}
                <div className="payRow">
                  <button className="payBtn primary" disabled={busy} onClick={submitCryptoBid}>
                    {busy ? 'Submitting…' : 'Submit for verification'}
                  </button>
                </div>
              </>
            )}

            {step === 'done' && (
              <>
                <h2>Bid placed.</h2>
                <p className="cryptoNote">
                  The board refreshes automatically. If you paid by USDT, your rank appears once the
                  transaction is confirmed.
                </p>
                <button className="payBtn primary" onClick={() => setModalOpen(false)}>
                  Back to the board
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { background: #12213a; }
      `}</style>

      <style jsx>{`
        .wrap {
          max-width: 780px;
          margin: 0 auto;
          padding: 64px 20px 40px;
          font-family: 'Inter', sans-serif;
          color: #12213a;
        }
        .hero { text-align: center; margin-bottom: 40px; }
        .eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: #d7cfa8;
          margin: 0 0 28px;
        }
        .logoContainer {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 22px;
        }
        .logoLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          outline: none;
          text-decoration: none;
        }
        .logoLink:focus-visible {
          outline: 2px solid #d7cfa8;
          outline-offset: 4px;
          border-radius: 4px;
        }
        .logoImg {
          max-width: 260px;
          width: min(260px, 70vw);
          height: auto;
          display: block;
          transition: all 0.2s ease;
        }
        @media (max-width: 480px) {
          .logoImg {
            width: 48px;
            height: 48px;
            object-fit: contain;
          }
        }
        .sub {
          font-size: 16px;
          line-height: 1.6;
          color: #b9c2d6;
          max-width: 480px;
          margin: 0 auto 32px;
        }
        .stampRow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .stamp {
          border: 2px solid #b08d3e;
          border-radius: 4px;
          padding: 10px 18px;
          transform: rotate(-2deg);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .stampLabel {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #b08d3e;
        }
        .stampAmount {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 24px;
          font-weight: 600;
          color: #f7f5ef;
        }
        .claimBtn {
          background: #a23b2e;
          color: #f7f5ef;
          border: none;
          padding: 16px 28px;
          border-radius: 4px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .claimBtn:hover { background: #8c3226; }

        .ledger {
          background: #f7f5ef;
          border-radius: 6px;
          overflow: hidden;
        }
        .ledgerHead {
          display: grid;
          grid-template-columns: 50px 1fr 100px 70px;
          padding: 14px 20px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: #7a7361;
          border-bottom: 1px solid #e3dfd0;
        }
        .row {
          display: grid;
          grid-template-columns: 50px 1fr 100px 70px;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9e6d8;
          text-decoration: none;
          color: inherit;
        }
        .row:hover { background: #efece0; }
        .rankNum {
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 600;
          color: #a23b2e;
        }
        .rowMain { display: flex; flex-direction: column; overflow: hidden; }
        .rowName {
          font-weight: 600;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rowUrl {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #7a7361;
        }
        .rowAmount {
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 600;
          color: #12213a;
        }
        .rowClicks {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          color: #7a7361;
          text-align: right;
        }
        .empty {
          padding: 40px 20px;
          text-align: center;
          color: #7a7361;
          font-family: 'IBM Plex Mono', monospace;
        }

        .foot {
          text-align: center;
          margin-top: 28px;
          color: #7a89a8;
          font-size: 13px;
        }
        .footLinks {
          margin-top: 8px;
        }
        .footLinks a {
          color: #d7cfa8;
          text-decoration: none;
        }
        .footLinks a:hover {
          text-decoration: underline;
        }

        .howItWorks {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 32px 0 40px;
          text-align: left;
        }
        .step {
          background: #1a2c4c;
          border: 1px solid #2d3f61;
          border-radius: 6px;
          padding: 20px;
          position: relative;
        }
        .stepNum {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #b08d3e;
          font-weight: 600;
          letter-spacing: 0.1em;
          display: block;
          margin-bottom: 8px;
        }
        .step h3 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          color: #f7f5ef;
          margin: 0 0 8px;
          font-weight: 600;
        }
        .step p {
          font-size: 13.5px;
          line-height: 1.5;
          color: #b9c2d6;
          margin: 0;
        }
        @media (max-width: 600px) {
          .howItWorks {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .tab {
          background: transparent;
          border: 1px solid #3a4356;
          color: #b9c2d6;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-family: 'IBM Plex Mono', monospace;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab:hover {
          color: #f7f5ef;
          border-color: #d7cfa8;
        }
        .tab.active {
          background: #d7cfa8;
          color: #12213a;
          border-color: #d7cfa8;
          font-weight: 600;
        }

        .activityTicker {
          background: #1a2c4c;
          border: 1px solid #2d3f61;
          border-radius: 4px;
          padding: 10px 16px;
          margin-bottom: 16px;
          text-align: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          color: #d7cfa8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(18, 33, 58, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .modal {
          background: #f7f5ef;
          border-radius: 8px;
          padding: 32px;
          max-width: 420px;
          width: 100%;
          position: relative;
        }
        .closeBtn {
          position: absolute;
          top: 12px;
          right: 16px;
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          color: #7a7361;
        }
        .modal h2 {
          font-family: 'Fraunces', serif;
          margin: 0 0 20px;
          color: #12213a;
        }
        label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin: 14px 0 6px;
          color: #12213a;
        }
        input, select {
          width: 100%;
          padding: 12px;
          border: 1px solid #d8d3c2;
          border-radius: 4px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          background: #fff;
          color: #12213a;
        }
        input:focus, select:focus {
          outline: 2px solid #a23b2e;
          outline-offset: 1px;
        }
        .err {
          color: #a23b2e;
          font-size: 13px;
          margin-top: 10px;
        }
        .payRow {
          display: flex;
          gap: 10px;
          margin-top: 22px;
          flex-wrap: wrap;
        }
        .payBtn {
          flex: 1;
          padding: 13px;
          border-radius: 4px;
          border: 1px solid #12213a;
          background: #fff;
          color: #12213a;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .payBtn.primary {
          background: #12213a;
          color: #f7f5ef;
        }
        .payBtn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cryptoNote {
          font-size: 14px;
          line-height: 1.6;
          color: #3a4356;
        }
        .addressBox {
          font-family: 'IBM Plex Mono', monospace;
          background: #12213a;
          color: #f7f5ef;
          padding: 14px;
          border-radius: 4px;
          font-size: 13px;
          word-break: break-all;
          margin: 12px 0;
        }

        /* ---------------------------------------------------- */
        /* Improved UI elements                                 */
        /* ---------------------------------------------------- */
        
        .spotlightCard {
          background: #fffdf5;
          border: 2px solid #b08d3e;
          border-radius: 8px;
          padding: 24px;
          margin: 0 0 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          position: relative;
        }
        .spotlightCard.emptySpotlight {
          border-style: dashed;
          background: transparent;
          border-color: #3a4356;
          box-shadow: none;
        }
        .spotlightBadge {
          align-self: flex-start;
          background: #b08d3e;
          color: #f7f5ef;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .emptySpotlight .spotlightBadge {
          background: #3a4356;
          color: #b9c2d6;
        }
        .spotlightMain {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .spotlightInfo {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 250px;
        }
        .spotlightName {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 600;
          color: #12213a;
          text-decoration: none;
          word-break: break-all;
        }
        .emptySpotlight .spotlightName {
          color: #f7f5ef;
        }
        .spotlightName:hover {
          text-decoration: underline;
        }
        .emptySpotlight .spotlightName:hover {
          text-decoration: none;
        }
        .spotlightUrl {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          color: #7a7361;
          word-break: break-all;
        }
        .emptySpotlight .spotlightUrl {
          color: #7a89a8;
        }
        .spotlightBid {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        @media (max-width: 600px) {
          .spotlightBid {
            align-items: flex-start;
          }
        }
        .spotlightBidLabel {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #7a7361;
          letter-spacing: 0.05em;
        }
        .emptySpotlight .spotlightBidLabel {
          color: #7a89a8;
        }
        .spotlightBidAmount {
          font-size: 36px;
          font-weight: 600;
          color: #a23b2e;
          font-family: 'IBM Plex Mono', monospace;
        }
        .emptySpotlight .spotlightBidAmount {
          color: #d7cfa8;
        }
        .spotlightFooter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #e9e6d8;
          padding-top: 16px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .emptySpotlight .spotlightFooter {
          border-top: 1px solid #2d3f61;
        }
        .spotlightBeatText {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          color: #12213a;
          font-weight: 500;
        }
        .emptySpotlight .spotlightBeatText {
          color: #b9c2d6;
        }
        .outbidBtn {
          background: #a23b2e;
          color: #f7f5ef;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.2s ease;
        }
        .outbidBtn:hover {
          background: #8c3226;
        }
        .emptySpotlight .outbidBtn {
          background: #d7cfa8;
          color: #12213a;
        }
        .emptySpotlight .outbidBtn:hover {
          background: #c3baa0;
        }

        /* Value Props section */
        .benefitsSection {
          margin: 48px 0;
          text-align: center;
        }
        .benefitsTitle {
          font-family: 'Fraunces', serif;
          font-size: 24px;
          color: #f7f5ef;
          margin: 0 0 8px;
          font-weight: 600;
        }
        .benefitsSubtitle {
          font-size: 15px;
          color: #b9c2d6;
          max-width: 580px;
          margin: 0 auto 28px;
          line-height: 1.6;
        }
        .benefitsGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          text-align: left;
        }
        @media (max-width: 600px) {
          .benefitsGrid {
            grid-template-columns: 1fr;
          }
        }
        .benefitCard {
          background: #1a2c4c;
          border: 1px solid #2d3f61;
          border-radius: 6px;
          padding: 20px;
        }
        .benefitIcon {
          font-size: 20px;
          display: block;
          margin-bottom: 10px;
        }
        .benefitCard h4 {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          color: #f7f5ef;
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .benefitCard p {
          font-size: 13.5px;
          line-height: 1.5;
          color: #b9c2d6;
          margin: 0;
        }

        /* Disclosure box inside Bidding Modal */
        .disclosureBox {
          background: #fff1f0;
          border: 1px solid #ffa39e;
          border-radius: 4px;
          padding: 12px 16px;
          margin-top: 18px;
          color: #a23b2e;
          font-size: 12.5px;
          line-height: 1.5;
        }
        .disclosureBox p {
          margin: 0 0 6px;
          font-weight: 600;
        }
        .disclosureBox ul {
          margin: 0;
          padding-left: 18px;
        }

        /* Improved Empty State */
        .emptyState {
          padding: 48px 24px;
          text-align: center;
          background: #f7f5ef;
          border-radius: 6px;
          color: #12213a;
        }
        .emptyTitle {
          display: block;
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #a23b2e;
        }
        .emptyText {
          font-size: 14.5px;
          line-height: 1.6;
          color: #7a7361;
          max-width: 460px;
          margin: 0 auto 20px;
        }
      `}</style>
    </main>
  );
}
