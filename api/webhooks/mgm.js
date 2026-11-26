import { createHash } from 'node:crypto';
import { admin, ok, fail, body } from '../_core.js';

function signature(fields, secret) {
  const pairs = Object.entries(fields || {})
    .filter(([key, value]) => key !== 'signature' && key !== 'payee' && value !== '' && value != null && typeof value !== 'object')
    .sort(([a], [b]) => Buffer.from(a).compare(Buffer.from(b)))
    .map(([key, value]) => `${key}=${value}`);
  return createHash('md5').update(`${pairs.join('&')}&key=${secret}`, 'utf8').digest('hex').toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 'Method not allowed.', 405);
  try {
    const payload = body(req);
    const data = payload.data || payload;
    const type = req.query?.type === 'deposit' ? 'deposit' : 'withdrawal';
    const secret = type === 'deposit' ? process.env.MGM_PAY_COLLECTION_KEY : process.env.MGM_PAY_PAYOUT_KEY;
    if (!secret || !data?.signature || signature(data, secret) !== String(data.signature).toUpperCase()) {
      return fail(res, 'Invalid MGM callback signature.', 401);
    }
    if (data.country && data.country !== 'NG') throw new Error('Unexpected callback country.');
    if (data.currency && data.currency !== 'NGN') throw new Error('Unexpected callback currency.');
    const reference = String(data.order_id || '');
    if (!reference) throw new Error('Callback order_id is required.');
    const sb = admin();
    const { data: tx, error: lookupError } = await sb.from('transactions')
      .select('id,type,status,amount,net_amount').eq('reference', reference).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!tx || tx.type !== type) throw new Error('Unknown MGM order.');
    const expected = type === 'deposit' ? Number(tx.amount) : Number(tx.net_amount);
    if (Number(data.amount) !== expected) throw new Error('Callback amount does not match the order.');
    if (tx.status !== 'pending') return res.status(200).send('SUCCESS');
    const statusCode = Number(data.status_code);
    if (statusCode === 100) {
      const rpc = type === 'deposit' ? 'approve_deposit' : 'complete_gateway_withdrawal';
      const args = type === 'deposit'
        ? { p_tx: tx.id, p_admin: null, p_note: 'Verified MGM Pay callback.' }
        : { p_tx: tx.id, p_admin: null, p_gateway_reference: data.settlement_id || reference };
      const { error } = await sb.rpc(rpc, args);
      if (error) throw new Error(error.message);
    } else if ([4, 5, 6].includes(statusCode)) {
      const { error } = type === 'deposit'
        ? await sb.rpc('reject_deposit', { p_tx: tx.id, p_admin: null, p_note: `MGM Pay terminal status ${statusCode}.` })
        : await sb.rpc('reject_withdrawal', { p_tx: tx.id, p_admin: null, p_note: `MGM Pay terminal status ${statusCode}.` });
      if (error) throw new Error(error.message);
    }
    return res.status(200).send('SUCCESS');
  } catch (e) {
    return fail(res, e, 400);
  }
}
