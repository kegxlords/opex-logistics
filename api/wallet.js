import { admin, user, ok, fail, body, settingsMap, num, ref, submitWithdrawalGateway, submitDepositGateway } from './_core.js';

export default async function handler(req, res) {
  const sb = admin();
  try {
    const u = await user(req);

    if (req.method === 'GET') {
      const type = req.query?.type || null;
      let q = sb.from('transactions').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(200);
      if (type && type !== 'all') q = q.eq('type', type);
      const [{ data: wallet }, { data: tx }, { data: cards }, s] = await Promise.all([
        sb.from('wallets').select('balance,income_balance,locked').eq('user_id', u.id).single(),
        q,
        sb.from('bank_accounts').select('*').eq('user_id', u.id).order('created_at'),
        settingsMap(sb)
      ]);
      return ok(res, { wallet, transactions: tx || [], cards: cards || [], settings: s });
    }

    if (req.method === 'POST') {
      const b = body(req);
      const s = await settingsMap(sb);

      if (b.action === 'deposit') {
        const amount = num(b.amount);
        const min = num(s.min_deposit, 0), max = num(s.max_deposit, Infinity);
        if (amount < min) throw new Error(`Minimum deposit is ₦${min.toLocaleString()}.`);
        if (amount > max) throw new Error(`Maximum deposit is ₦${max.toLocaleString()}.`);
        const reference = ref('DEP');
        const senderName = String(b.sender_name || '').trim().slice(0, 80);
        const { data, error } = await sb.from('transactions').insert({
          user_id: u.id, type: 'deposit', amount, fee: 0, net_amount: amount,
          description: 'Bank transfer deposit' + (senderName ? ' · Sender: ' + senderName : ''),
          reference, status: 'pending'
        }).select().single();
        if (error) throw new Error(error.message);
        if (process.env.MGM_PROXY_URL) {
          try {
            const gateway = await submitDepositGateway(data);
            await sb.from('transactions').update({ gateway_status: 'submitted', gateway_reference: gateway.reference, gateway_submitted_at: new Date().toISOString() }).eq('id', data.id);
            return ok(res, { transaction: { ...data, gateway_status: 'submitted', gateway_reference: gateway.reference }, reference, checkout_url: gateway.checkoutUrl, message: 'Deposit order created. Complete payment on MGM Pay.' });
          } catch (gatewayError) {
            await sb.from('transactions').update({ gateway_status: 'failed', gateway_error: gatewayError.message }).eq('id', data.id);
            throw gatewayError;
          }
        }
        return ok(res, { transaction: data, reference, message: 'Deposit submitted for review.' });
      }

      if (b.action === 'withdraw') {
        const amount = num(b.amount);
        if (!b.card_id) throw new Error('Save a payout card before withdrawing.');
        const { data, error } = await sb.rpc('request_withdrawal', { p_user: u.id, p_amount: amount, p_card: b.card_id });
        if (error) throw new Error(error.message);
        let { data: tx } = await sb.from('transactions').select('*').eq('id', data).single();
        let message = tx?.processing_mode === 'manual' ? 'Withdrawal queued for manual processing.'
          : tx?.processing_mode === 'review' ? 'Withdrawal submitted for administrator review.'
          : 'Withdrawal submitted to the payout gateway.';
        if (tx?.processing_mode === 'gateway') {
          try {
            const result = await submitWithdrawalGateway(tx);
            const { error: submissionError } = await sb.rpc('record_gateway_withdrawal_submission', {
              p_tx: tx.id, p_gateway_reference: result.reference
            });
            if (submissionError) throw new Error(submissionError.message);
            const refreshed = await sb.from('transactions').select('*').eq('id', tx.id).single();
            tx = refreshed.data || tx;
            message = 'Withdrawal accepted by MGM Pay and awaiting settlement confirmation.';
          } catch (gatewayError) {
            const { error: recordError } = await sb.rpc('record_gateway_withdrawal_failure', {
              p_tx: tx.id, p_error: gatewayError.message
            });
            if (recordError) throw new Error(recordError.message);
            message = 'Withdrawal queued, but the gateway attempt failed. An administrator will retry it.';
          }
        }
        return ok(res, {
          transaction: tx, reference: tx?.reference, fee: Number(tx?.fee || 0),
          net: Number(tx?.net_amount || 0), message
        });
      }

      throw new Error('Unknown action.');
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    return fail(res, e, /Unauthorized|suspended/.test(e.message) ? 401 : 400);
  }
}
