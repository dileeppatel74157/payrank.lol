export async function verifyUsdtTransfer(txHash, walletAddress, expectedAmountUSD) {
  try {
    if (!txHash || !walletAddress || !expectedAmountUSD) {
      return { verified: false, reason: 'missing_parameters' };
    }

    const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

    const url = new URL(`https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20`);
    url.searchParams.set('limit', '200');
    url.searchParams.set('only_confirmed', 'true');
    url.searchParams.set('only_to', 'true');
    url.searchParams.set('contract_address', USDT_TRC20_CONTRACT);

    const headers = {};
    if (process.env.TRONGRID_API_KEY) {
      headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.error(`TronGrid API error: ${response.status} ${response.statusText}`);
      return { verified: false, reason: 'api_error' };
    }

    const resData = await response.json();
    if (!resData || !Array.isArray(resData.data)) {
      console.error('TronGrid API returned invalid format:', resData);
      return { verified: false, reason: 'invalid_api_response' };
    }

    const tx = resData.data.find(
      (t) => t.transaction_id && t.transaction_id.toLowerCase() === txHash.toLowerCase()
    );

    if (!tx) {
      return { verified: false, reason: 'not_found_yet' };
    }

    // Verify the "to" address matches walletAddress (case-insensitive to be safe)
    if (!tx.to || tx.to.toLowerCase() !== walletAddress.toLowerCase()) {
      return { verified: false, reason: 'wallet_address_mismatch' };
    }

    // Verify the amount
    const decimals = tx.token_info?.decimals ?? 6;
    const value = tx.value;
    if (!value) {
      return { verified: false, reason: 'missing_value' };
    }

    const amount = Number(value) / Math.pow(10, decimals);
    const tolerance = 0.01;

    if (amount < expectedAmountUSD - tolerance) {
      return { verified: false, reason: 'insufficient_amount', amount };
    }

    return { verified: true, amount };
  } catch (error) {
    console.error('verifyUsdtTransfer unexpected error:', error);
    return { verified: false, reason: 'unexpected_error' };
  }
}
