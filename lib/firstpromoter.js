/**
 * Calculates net revenue and commission based on payment details.
 *
 * Net Revenue = Gross Bid - GST Amount - Gateway/Processing Fee
 * Creator Commission = Net Revenue * Commission %
 *
 * Note: Calculations assume GST is inclusive in the gross bid amount.
 *
 * @param {number} amount - Gross bid amount in USD or USDT
 * @param {string} paymentMethod - 'razorpay' or 'crypto'
 * @returns {object} Calculated breakdown of GST, gateway fee, net revenue, and commission
 */
export function calculateCreatorCommission(amount, paymentMethod) {
  const commissionPercent = Number(process.env.REFERRAL_COMMISSION_PERCENTAGE || 20);
  let gstPercent = 0;
  let feePercent = 0;
  let feeFixed = 0;

  if (paymentMethod === 'razorpay') {
    gstPercent = Number(process.env.RAZORPAY_GST_PERCENTAGE || 18);
    feePercent = Number(process.env.RAZORPAY_FEE_PERCENTAGE || 2);
    feeFixed = Number(process.env.RAZORPAY_FEE_FIXED || 0);
  } else if (paymentMethod === 'crypto') {
    gstPercent = Number(process.env.CRYPTO_GST_PERCENTAGE || 0);
    feePercent = Number(process.env.CRYPTO_FEE_PERCENTAGE || 0);
    feeFixed = Number(process.env.CRYPTO_FEE_FIXED || 0);
  }

  // GST Calculation (inclusive in payment amount)
  // Formula: gstAmount = amount - (amount / (1 + (gstPercent / 100)))
  const gstAmount = amount - (amount / (1 + (gstPercent / 100)));

  // Payment gateway/processing fee
  // Formula: gatewayFee = (amount * (feePercent / 100)) + feeFixed
  const gatewayFee = (amount * (feePercent / 100)) + feeFixed;

  // Net revenue after GST and fees
  const netRevenue = Math.max(0, amount - gstAmount - gatewayFee);

  // Creator commission
  const commissionAmount = netRevenue * (commissionPercent / 100);

  return {
    grossAmount: amount,
    gstAmount: Number(gstAmount.toFixed(4)),
    gatewayFee: Number(gatewayFee.toFixed(4)),
    netRevenue: Number(netRevenue.toFixed(4)),
    commissionPercentage: commissionPercent,
    commissionAmount: Number(commissionAmount.toFixed(4)),
  };
}

/**
 * Tracks a sale/conversion in FirstPromoter.
 * Sends the net revenue (converted to cents) to the FirstPromoter API.
 * Uses the paymentReference (gateway transaction ID or crypto transaction hash) as the event_id for idempotency.
 *
 * @param {object} params
 * @param {number} params.amountUSD - Gross bid amount in USD
 * @param {string} params.paymentMethod - 'razorpay' or 'crypto'
 * @param {string} params.paymentReference - Razorpay payment ID or crypto transaction hash
 * @param {string} params.referralCode - FirstPromoter referral/affiliate code (_fprom_ref)
 * @param {string} params.trackingId - FirstPromoter tracking ID (_fprom_tid)
 * @param {string} params.bidId - Local database bid UUID (used as UID)
 * @returns {Promise<object>} Results of the tracking attempt
 */
export async function trackFirstPromoterConversion({
  amountUSD,
  paymentMethod,
  paymentReference,
  referralCode,
  trackingId,
  bidId,
}) {
  if (!referralCode && !trackingId) {
    console.log(`[FirstPromoter] No referral code or tracking ID for bid ${bidId}. Skipping conversion.`);
    return { tracked: false, reason: 'no_referral' };
  }

  const apiKey = process.env.FIRSTPROMOTER_API_KEY;
  const accountId = process.env.FIRSTPROMOTER_ACCOUNT_ID;

  if (!apiKey) {
    console.warn('[FirstPromoter] FIRSTPROMOTER_API_KEY is not configured. Skipping conversion tracking.');
    return { tracked: false, reason: 'missing_config' };
  }

  // Calculate Net Revenue
  const calc = calculateCreatorCommission(amountUSD, paymentMethod);
  const saleAmountCents = Math.round(calc.netRevenue * 100);

  // Build FirstPromoter payload
  const payload = {
    uid: bidId,
    email: `transaction-${bidId}@payrank.lol`,
    amount: saleAmountCents,
    event_id: paymentReference,
  };

  if (trackingId) payload.tid = trackingId;
  if (referralCode) payload.ref_id = referralCode;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };

    // Support Authorization Bearer + ACCOUNT-ID headers for modern API keys
    if (accountId) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['ACCOUNT-ID'] = accountId;
    }

    console.log(`[FirstPromoter] Sending conversion request for bid ${bidId} to FirstPromoter:`, payload);

    const response = await fetch('https://firstpromoter.com/api/v1/track/sale', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.status === 204 || response.ok) {
      console.log(`[FirstPromoter] Conversion tracked successfully for bid ${bidId}`);
      return { tracked: true, netRevenue: calc.netRevenue, commissionAmount: calc.commissionAmount };
    } else {
      const text = await response.text();
      console.error(`[FirstPromoter] Failed to track conversion. Status: ${response.status}. Response: ${text}`);
      return { tracked: false, reason: `api_status_${response.status}`, details: text };
    }
  } catch (error) {
    console.error(`[FirstPromoter] Unexpected error tracking conversion:`, error);
    return { tracked: false, reason: 'unexpected_error', details: error.message };
  }
}

/**
 * Reverses a commission in FirstPromoter due to a processed refund.
 * Uses the original paymentReference (event_id in FirstPromoter) to locate and reverse the sale.
 *
 * @param {object} params
 * @param {number} params.amountUSD - Refunded gross amount in USD
 * @param {string} params.paymentMethod - 'razorpay' or 'crypto'
 * @param {string} params.paymentReference - Original Razorpay payment ID or crypto transaction hash
 * @param {string} params.bidId - Local database bid UUID
 * @returns {Promise<object>} Results of the refund tracking attempt
 */
export async function trackFirstPromoterRefund({
  amountUSD,
  paymentMethod,
  paymentReference,
  bidId,
}) {
  const apiKey = process.env.FIRSTPROMOTER_API_KEY;
  const accountId = process.env.FIRSTPROMOTER_ACCOUNT_ID;

  if (!apiKey) {
    console.warn('[FirstPromoter] FIRSTPROMOTER_API_KEY is not configured. Skipping refund tracking.');
    return { tracked: false, reason: 'missing_config' };
  }

  // Calculate Net Revenue portion of the refund
  const calc = calculateCreatorCommission(amountUSD, paymentMethod);
  const refundAmountCents = Math.round(calc.netRevenue * 100);

  const payload = {
    event_id: paymentReference,
    amount: refundAmountCents,
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };

    if (accountId) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['ACCOUNT-ID'] = accountId;
    }

    console.log(`[FirstPromoter] Sending refund request for event ${paymentReference} to FirstPromoter:`, payload);

    const response = await fetch('https://firstpromoter.com/api/v1/track/refund', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`[FirstPromoter] Refund tracked successfully for event ${paymentReference}`);
      return { tracked: true };
    } else {
      const text = await response.text();
      console.error(`[FirstPromoter] Failed to track refund. Status: ${response.status}. Response: ${text}`);
      return { tracked: false, reason: `api_status_${response.status}`, details: text };
    }
  } catch (error) {
    console.error(`[FirstPromoter] Unexpected error tracking refund:`, error);
    return { tracked: false, reason: 'unexpected_error', details: error.message };
  }
}
