import { createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const hashToken = token => createHash('sha256').update(String(token)).digest('hex');

export const admin = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

export async function user(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) throw new Error('Unauthorized — no token supplied.');
  const token = String(h).replace(/^Bearer\s+/i, '');
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new Error('Unauthorized — invalid session.');
  const { data: adminProfile } = await sb.from('profiles').select('is_active,is_admin').eq('id', data.user.id).single();
  if (adminProfile && adminProfile.is_active === false) throw new Error('This account has been suspended.');

  const impersonationToken = req.headers['x-impersonation-token'] || req.headers['X-Impersonation-Token'];
  if (impersonationToken) {
    if (!adminProfile?.is_admin) throw new Error('Only an administrator can impersonate a member.');
    const { data: session, error: sessionError } = await sb.from('admin_impersonation_sessions')
      .select('id,user_id,expires_at').eq('token_hash', hashToken(impersonationToken))
      .eq('admin_id', data.user.id).is('ended_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (sessionError || !session) throw new Error('This member session has expired.');
    const { data: target, error: targetError } = await sb.from('profiles').select('id,email,is_active').eq('id', session.user_id).single();
    if (targetError || !target) throw new Error('The impersonated member no longer exists.');
    if (target.is_active === false) throw new Error('This member account is suspended.');
    return { ...data.user, id: target.id, email: target.email || data.user.email, is_admin: false, impersonated: true, admin_id: data.user.id };
  }

  return { ...data.user, is_admin: !!adminProfile?.is_admin };
}

export async function requireAdmin(req) {
  const u = await user(req);
  if (!u.is_admin) throw new Error('Forbidden — administrator access required.');
  return u;
}

export const ok = (res, data = {}) => res.status(200).json({ success: true, ...data });
export const fail = (res, err, code = 400) =>
  res.status(code).json({ success: false, error: typeof err === 'string' ? err : err.message });

export const body = req => {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
};

export const settingsMap = async sb => {
  const { data } = await sb.from('settings').select('key,value');
  const m = {};
  (data || []).forEach(r => { m[r.key] = r.value; });
  return m;
};

export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export const minutes = t => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function lagosNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dow: map[parts.find(p => p.type === 'weekday').value],
    mins: Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value),
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  };
}

export const ref = prefix => prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

async function callMgmRelay(action, payload) {
  const url = String(process.env.MGM_PROXY_URL || '').trim();
  const secret = String(process.env.MGM_PROXY_SHARED_SECRET || '').trim();
  if (!url || !secret) throw new Error('MGM cPanel relay is not configured. Set MGM_PROXY_URL and MGM_PROXY_SHARED_SECRET in Vercel.');
  const config = {
    base_url: process.env.MGM_PAY_BASE_URL || 'https://api.mgm-paysandbox.com',
    merchant_no: process.env.MGM_PAY_MERCHANT_NO,
    app_id: process.env.MGM_PAY_APP_ID,
    collection_key: process.env.MGM_PAY_COLLECTION_KEY,
    payout_key: process.env.MGM_PAY_PAYOUT_KEY,
    deposit_notification_url: process.env.MGM_PAY_DEPOSIT_NOTIFICATION_URL,
    withdrawal_notification_url: process.env.MGM_PAY_WITHDRAWAL_NOTIFICATION_URL,
    success_redirect_url: process.env.MGM_PAY_SUCCESS_REDIRECT_URL
  };
  const body = JSON.stringify({ action, config, ...payload });
  const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mgm-proxy-signature': signature }, signal: controller.signal, body });
    const raw = await response.text();
    let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!response.ok || data.success === false) throw new Error(data.error || data.message || `MGM relay returned HTTP ${response.status}.`);
    return data;
  } finally { clearTimeout(timer); }
}

export async function submitWithdrawalGateway(tx) {
  if (!tx.bank_code) throw new Error('This payout card has no Nigerian bank code. Update the saved payout card.');
  const result = await callMgmRelay('withdrawal', { reference: tx.reference, amount: Number(tx.net_amount), account_name: tx.account_name, account_number: tx.account_number, bank_code: tx.bank_code });
  return { reference: result.gateway_reference || tx.reference };
}

export async function submitDepositGateway(tx) {
  const result = await callMgmRelay('deposit', { reference: tx.reference, amount: Number(tx.amount) });
  return { reference: result.gateway_reference || tx.reference, checkoutUrl: result.checkout_url || null };
}
