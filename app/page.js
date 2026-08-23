'use client';

import { useEffect, useState } from 'react';
import { supabasePublic } from '@/lib/supabase';

const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || 'ADD_YOUR_TRC20_ADDRESS';

export default function Page() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState('form'); // form | crypto | done
  const [form, setForm] = useState({ url: '', displayName: '', category: 'other', amount: 10 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  async function loadListings() {
    const { data } = await supabasePublic
      .from('listings')
      .select('id, url, display_name, category, total_bid, clicks, created_at')
      .order('total_bid', { ascending: false })
      .limit(50);
    setListings(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadListings();
    const interval = setInterval(loadListings, 15000);
    return () => clearInterval(interval);
  }, []);

  const topBid = listings[0]?.total_bid || 0;
  const priceToBeatNumber1 = Math.floor(topBid) + 1;

  function openModal() {
    setForm({ url: '', displayName: '', category: 'other', amount: Math.max(2, priceToBeatNumber1 > 1 ? 5 : 2) });
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

  return (
    <main className="wrap">
      <header className="hero">
        <p className="eyebrow">NO ALGORITHM · NO VOTES · JUST THE PRICE</p>
        <h1>PayRank</h1>
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

      <section className="ledger">
        <div className="ledgerHead">
          <span>Rank</span>
          <span>Listing</span>
          <span>Paid</span>
          <span>Clicks</span>
        </div>

        {loading && <p className="empty">Loading the board…</p>}
        {!loading && listings.length === 0 && (
          <p className="empty">No bids yet. Be lot #1.</p>
        )}

        {listings.map((item, i) => (
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
                <label>Bid amount (USD)</label>
                <input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
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
          margin: 0 0 12px;
        }
        h1 {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 64px;
          color: #f7f5ef;
          margin: 0 0 16px;
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
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #d8d3c2;
          border-radius: 4px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          background: #fff;
        }
        input:focus {
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
      `}</style>
    </main>
  );
}
