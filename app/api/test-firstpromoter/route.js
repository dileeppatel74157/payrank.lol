import { NextResponse } from 'next/server';
import { calculateCreatorCommission, trackFirstPromoterConversion, trackFirstPromoterRefund } from '@/lib/firstpromoter';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const results = [];

  // Helper to assert
  function assertEqual(expected, actual, message) {
    if (Math.abs(expected - actual) < 0.0001) {
      results.push({ status: 'PASS', message: `${message}: expected ${expected}, got ${actual}` });
    } else {
      results.push({ status: 'FAIL', message: `${message}: expected ${expected}, got ${actual}` });
    }
  }

  // Backup original env vars
  const origApiKey = process.env.FIRSTPROMOTER_API_KEY;
  const origAccId = process.env.FIRSTPROMOTER_ACCOUNT_ID;
  const origCommission = process.env.REFERRAL_COMMISSION_PERCENTAGE;
  const origRpGst = process.env.RAZORPAY_GST_PERCENTAGE;
  const origRpFee = process.env.RAZORPAY_FEE_PERCENTAGE;

  try {
    // Set custom config for tests
    process.env.REFERRAL_COMMISSION_PERCENTAGE = '20';
    process.env.RAZORPAY_GST_PERCENTAGE = '18';
    process.env.RAZORPAY_FEE_PERCENTAGE = '2';
    process.env.RAZORPAY_FEE_FIXED = '0';
    process.env.CRYPTO_GST_PERCENTAGE = '0';
    process.env.CRYPTO_FEE_PERCENTAGE = '0';
    process.env.CRYPTO_FEE_FIXED = '0';

    // Test 1: Razorpay Math
    const rpCalc = calculateCreatorCommission(1000, 'razorpay');
    assertEqual(152.5424, rpCalc.gstAmount, 'Razorpay GST inclusive (18%)');
    assertEqual(20.00, rpCalc.gatewayFee, 'Razorpay Fee (2%)');
    assertEqual(827.4576, rpCalc.netRevenue, 'Razorpay Net Revenue');
    assertEqual(165.4915, rpCalc.commissionAmount, 'Razorpay Creator Commission (20%)');

    // Test 2: Crypto Math
    const cryptoCalc = calculateCreatorCommission(100, 'crypto');
    assertEqual(0, cryptoCalc.gstAmount, 'Crypto GST (0%)');
    assertEqual(0, cryptoCalc.gatewayFee, 'Crypto Fee (0%)');
    assertEqual(100.00, cryptoCalc.netRevenue, 'Crypto Net Revenue');
    assertEqual(20.00, cryptoCalc.commissionAmount, 'Crypto Creator Commission (20%)');

    // Mock global fetch to capture outgoing API requests
    const originalFetch = global.fetch;
    let capturedPayload = null;
    let capturedHeaders = null;
    let capturedUrl = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedPayload = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        status: 204,
        ok: true,
        text: async () => 'mock_success'
      };
    };

    try {
      process.env.FIRSTPROMOTER_API_KEY = 'test_api_key';
      process.env.FIRSTPROMOTER_ACCOUNT_ID = 'test_acc_id';

      // Test 3: FirstPromoter Conversion payload construction
      await trackFirstPromoterConversion({
        amountUSD: 1000,
        paymentMethod: 'razorpay',
        paymentReference: 'pay_test_ref_123',
        referralCode: 'CREATOR_TEST',
        trackingId: 'tid_test_123',
        bidId: 'a0000000-0000-0000-0000-000000000001'
      });

      assertEqual(82746, capturedPayload.amount, 'Sale amount converted to cents');
      
      if (capturedPayload.uid === 'a0000000-0000-0000-0000-000000000001') {
        results.push({ status: 'PASS', message: 'UID mapped correctly to bidId UUID' });
      } else {
        results.push({ status: 'FAIL', message: `UID mapping wrong, got ${capturedPayload.uid}` });
      }

      if (capturedPayload.ref_id === 'CREATOR_TEST' && capturedPayload.tid === 'tid_test_123') {
        results.push({ status: 'PASS', message: 'Referral code and tracking ID passed correctly' });
      } else {
        results.push({ status: 'FAIL', message: 'Referral markers wrong' });
      }

      if (capturedHeaders['x-api-key'] === 'test_api_key' && capturedHeaders['ACCOUNT-ID'] === 'test_acc_id') {
        results.push({ status: 'PASS', message: 'Authentication headers mapped correctly' });
      } else {
        results.push({ status: 'FAIL', message: 'Authentication headers wrong' });
      }

      // Test 4: FirstPromoter Refund payload construction
      capturedPayload = null;
      await trackFirstPromoterRefund({
        amountUSD: 1000,
        paymentMethod: 'razorpay',
        paymentReference: 'pay_test_ref_123',
        bidId: 'a0000000-0000-0000-0000-000000000001'
      });

      assertEqual(82746, capturedPayload.amount, 'Refund amount converted to cents');
      
      if (capturedPayload.event_id === 'pay_test_ref_123') {
        results.push({ status: 'PASS', message: 'Refund event_id maps to original paymentReference' });
      } else {
        results.push({ status: 'FAIL', message: `Refund event_id wrong, got ${capturedPayload.event_id}` });
      }

    } finally {
      global.fetch = originalFetch;
    }

  } catch (err) {
    results.push({ status: 'FAIL', message: `Unexpected error running tests: ${err.message}` });
  } finally {
    // Restore original env vars
    if (origApiKey) process.env.FIRSTPROMOTER_API_KEY = origApiKey;
    if (origAccId) process.env.FIRSTPROMOTER_ACCOUNT_ID = origAccId;
    if (origCommission) process.env.REFERRAL_COMMISSION_PERCENTAGE = origCommission;
    if (origRpGst) process.env.RAZORPAY_GST_PERCENTAGE = origRpGst;
    if (origRpFee) process.env.RAZORPAY_FEE_PERCENTAGE = origRpFee;
  }

  const failedCount = results.filter(r => r.status === 'FAIL').length;
  return NextResponse.json({
    allPassed: failedCount === 0,
    failedCount,
    results
  });
}
