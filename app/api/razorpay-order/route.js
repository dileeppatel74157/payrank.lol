import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Creates a Razorpay order for the bid amount (in USD, converted to paise/cents by Razorpay's currency setting).
// The actual listing/bid row is only written once the webhook confirms payment — never trust the client.
export async function POST(req) {
  try {
    const { amountUSD, url, displayName, category, referralCode, trackingId } = await req.json();

    if (!amountUSD || amountUSD < 1 || !url) {
      return NextResponse.json({ error: 'A valid amount and URL are required.' }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountUSD * 100), // Razorpay expects the smallest currency unit
      currency: 'USD',
      notes: {
        url,
        display_name: displayName || url,
        category: category || 'other',
        referral_code: referralCode || '',
        tracking_id: trackingId || '',
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('razorpay-order error', err);
    return NextResponse.json({ error: 'Could not create the payment order.' }, { status: 500 });
  }
}
