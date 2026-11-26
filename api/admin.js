import { createHash, randomBytes } from 'node:crypto';
import { admin, requireAdmin, ok, fail, body, num, submitWithdrawalGateway } from './_core.js';

const hashToken = token => createHash('sha256').update(String(token)).digest('hex');
const queueStatuses = new Set(['all', 'pending', 'completed', 'rejected']);
const unitStatuses = new Set(['live', 'hidden', 'upcoming', 'deleted']);
const withdrawalModes = new Set(['gateway', 'review', 'manual']);
const validDays = value => {
  const days = String(value || '').split(',').map(v => Number(v.trim()));
  return days.length > 0 && days.every(Number.isInteger) && days.every(v => v >= 0 && v <= 6) && new Set(days).size === days.length;
};

export default async function handler(req, res) {
  const sb = admin();
  try {
    const actor = await requireAdmin(req);

    if (req.method === 'GET') {
      const view = req.query?.view || 'overview';

      if (view === 'overview') {
        const [users, active, funded, dep, wd, pendDep, pendWd, leases, recent, cron] = await Promise.all([
          sb.from('profiles').select('id', { count: 'exact', head: true }),
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('has_funded', true),
          sb.from('profiles').select('total_funded'),
          sb.from('transactions').select('net_amount').eq('type', 'deposit').eq('status', 'completed'),
          sb.from('transactions').select('net_amount').eq('type', 'withdrawal').eq('status', 'completed'),
          sb.from('transactions').select('amount').eq('type', 'deposit').eq('status', 'pending'),
          sb.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'pending'),
          sb.from('leases').select('id', { count: 'exact', head: true }),
          sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(20),
          sb.from('cron_runs').select('*').order('created_at', { ascending: false }).limit(10)
        ]);
        const sum = r => (r.data || []).reduce((a, x) => a + Number(x.net_amount ?? x.amount ?? x.total_funded ?? 0), 0);
        return ok(res, {
          stats: {
            users: users.count || 0, activeUsers: active.count || 0,
            deposits: sum(dep), withdrawals: sum(wd),
            pendingDeposits: pendDep.data?.length || 0, pendingDepositValue: sum(pendDep),
            pendingWithdrawals: pendWd.data?.length || 0, pendingWithdrawalValue: sum(pendWd),
            leases: leases.count || 0, totalFunded: sum(funded)
          },
          recent: recent.data || [], cron: cron.data || []
        });
      }

      if (view === 'users') {
        const { data } = await sb.from('profiles')
          .select('*, wallets(balance,income_balance,locked)')
          .order('created_at', { ascending: false }).limit(500);
        return ok(res, { users: data || [] });
      }

      if (view === 'member') {
        const id = req.query?.id;
        if (!id) throw new Error('Member id required.');
        if (req.query?.impersonation_token) {
          const { data: session, error } = await sb.from('admin_impersonation_sessions')
            .select('id').eq('token_hash', hashToken(req.query.impersonation_token))
            .eq('admin_id', actor.id).eq('user_id', id).is('ended_at', null)
            .gt('expires_at', new Date().toISOString()).maybeSingle();
          if (error) throw new Error(error.message);
          if (!session) throw new Error('This member preview session has expired.');
        }
        const cols = 'id,full_name,created_at,has_funded,total_funded';
        const [p, w, ls, tx, cards, l1, l2, l3, comm, ci] = await Promise.all([
          sb.from('profiles').select('*').eq('id', id).single(),
          sb.from('wallets').select('*').eq('user_id', id).single(),
          sb.from('leases').select('*, units(*)').eq('user_id', id).order('started_at', { ascending: false }),
          sb.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(120),
          sb.from('bank_accounts').select('*').eq('user_id', id),
          sb.from('profiles').select(cols).eq('referred_by', id),
          sb.from('profiles').select(cols).eq('upline_2', id),
          sb.from('profiles').select(cols).eq('upline_3', id),
          sb.from('referral_commissions').select('*').eq('beneficiary_id', id).order('created_at', { ascending: false }),
          sb.from('checkins').select('*').eq('user_id', id).order('checkin_date', { ascending: false }).limit(40)
        ]);
        const memberLeases = (ls.data || []).map(lease => {
          const unit = lease.units;
          if (!unit) return lease;
          return Object.assign({}, lease, { unit: Object.assign({}, unit, {
            price: lease.unit_price ?? unit.price,
            daily_yield: lease.daily_yield ?? unit.daily_yield,
            duration_days: lease.duration_days ?? unit.duration_days,
            income_drop_days: lease.income_drop_days || unit.income_drop_days
          }) });
        });
        return ok(res, {
          profile: p.data, wallet: w.data, leases: memberLeases, transactions: tx.data || [],
          cards: cards.data || [], team: { l1: l1.data || [], l2: l2.data || [], l3: l3.data || [] },
          commissions: comm.data || [], checkins: ci.data || []
        });
      }

      if (view === 'queue') {
        const type = req.query?.type === 'withdrawal' ? 'withdrawal' : 'deposit';
        const requestedStatus = req.query?.status === 'successful' ? 'completed' : (req.query?.status || 'pending');
        const status = queueStatuses.has(requestedStatus) ? requestedStatus : 'pending';
        let q = sb.from('transactions').select('*, profiles!transactions_user_id_fkey(full_name,email)').eq('type', type).order('created_at', { ascending: false }).limit(300);
        if (status !== 'all') q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return ok(res, { transactions: data || [] });
      }

      if (view === 'units') {
        const { data } = await sb.from('units').select('*').neq('status', 'deleted').order('sort_order');
        return ok(res, { units: data || [] });
      }

      if (view === 'settings') {
        const { data } = await sb.from('settings').select('*');
        const map = {}; (data || []).forEach(r => { map[r.key] = r.value; });
        return ok(res, { settings: map });
      }

      throw new Error('Unknown view.');
    }

    if (req.method === 'POST') {
      const b = body(req);
      const a = b.action;
      const p = b.payload || {};

      switch (a) {
        case 'approve_deposit':
          await sb.rpc('approve_deposit', { p_tx: p.id, p_admin: actor.id, p_note: p.note || null });
          return ok(res, { message: 'Deposit approved, wallet credited, commissions paid.' });

        case 'reject_deposit':
          if (!p.note) throw new Error('A reason is required to reject a deposit.');
          await sb.rpc('reject_deposit', { p_tx: p.id, p_admin: actor.id, p_note: p.note });
          return ok(res, { message: 'Deposit rejected.' });

        case 'approve_withdrawal':
          {
            const { data: tx, error: txError } = await sb.from('transactions').select('*').eq('id', p.id).eq('type', 'withdrawal').single();
            if (txError || !tx) throw new Error('Withdrawal not found.');
            if (tx.processing_mode === 'manual') {
              const { error } = await sb.rpc('approve_withdrawal', { p_tx: p.id, p_admin: actor.id, p_note: p.note || null });
              if (error) throw new Error(error.message);
              return ok(res, { message: 'Withdrawal marked as paid manually.' });
            }
            try {
              const result = await submitWithdrawalGateway(tx);
              const { error } = await sb.rpc('record_gateway_withdrawal_submission', { p_tx: p.id, p_gateway_reference: result.reference });
              if (error) throw new Error(error.message);
              return ok(res, { message: 'Withdrawal approved and accepted by MGM Pay; awaiting settlement confirmation.' });
            } catch (gatewayError) {
              const { error } = await sb.rpc('record_gateway_withdrawal_failure', { p_tx: p.id, p_error: gatewayError.message });
              if (error) throw new Error(error.message);
              throw new Error('Gateway submission failed; the withdrawal remains pending for retry.');
            }
          }

        case 'reject_withdrawal':
          if (!p.note) throw new Error('A reason is required to reject a withdrawal.');
          await sb.rpc('reject_withdrawal', { p_tx: p.id, p_admin: actor.id, p_note: p.note });
          return ok(res, { message: 'Withdrawal rejected and balance released.' });

        case 'credit':
        case 'debit':
          if (!p.note) throw new Error('A note is required for wallet adjustments.');
          await sb.rpc('admin_adjust_wallet', {
            p_admin: actor.id, p_user: p.user_id, p_amount: num(p.amount),
            p_direction: a, p_note: p.note
          });
          return ok(res, { message: a === 'credit' ? 'Wallet topped up.' : 'Wallet deducted.' });

        case 'grant_lease':
        case 'grant_package':
          if (!p.user_id || !p.unit_id) throw new Error('Member and package are required.');
          await sb.rpc('admin_grant_lease', { p_admin: actor.id, p_user: p.user_id, p_unit: p.unit_id });
          return ok(res, { message: 'Package granted.' });

        case 'ban':
          await sb.rpc('admin_set_ban', { p_admin: actor.id, p_user: p.user_id, p_active: false });
          return ok(res, { message: 'Member suspended.' });

        case 'unban':
          await sb.rpc('admin_set_ban', { p_admin: actor.id, p_user: p.user_id, p_active: true });
          return ok(res, { message: 'Member reinstated.' });

        case 'impersonate':
          if (!p.user_id) throw new Error('Member id required.');
          {
            const { data: target, error: targetError } = await sb.from('profiles').select('id').eq('id', p.user_id).maybeSingle();
            if (targetError) throw new Error(targetError.message);
            if (!target) throw new Error('Member not found.');
            const token = randomBytes(32).toString('base64url');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            const { error: sessionError } = await sb.from('admin_impersonation_sessions').insert({
              token_hash: hashToken(token), admin_id: actor.id, user_id: p.user_id, expires_at: expiresAt
            });
            if (sessionError) throw new Error(sessionError.message);
            const { error } = await sb.rpc('admin_impersonate', { p_admin: actor.id, p_user: p.user_id });
            if (error) throw new Error(error.message);
            return ok(res, { message: 'Member preview session opened and logged.', impersonation: { token, user_id: p.user_id, expires_at: expiresAt } });
          }

        case 'end_impersonation': {
          if (!p.user_id) throw new Error('Member id required.');
          if (p.token) {
            const { error: sessionError } = await sb.from('admin_impersonation_sessions').update({ ended_at: new Date().toISOString() })
              .eq('token_hash', hashToken(p.token)).eq('admin_id', actor.id).eq('user_id', p.user_id).is('ended_at', null);
            if (sessionError) throw new Error(sessionError.message);
          }
          const { error } = await sb.from('audit_log').insert({
            actor: actor.id, action: 'end_impersonation', target: p.user_id,
            meta: { at: new Date().toISOString() }
          });
          if (error) throw new Error(error.message);
          return ok(res, { message: 'Member preview exit logged.' });
        }

        case 'create_unit': {
          const row = {
            slug: String(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now().toString(36),
            name: p.name, tier: p.tier || p.name,
            price: num(p.price), daily_yield: num(p.daily_yield),
            duration_days: num(p.duration_days, 30), purchase_limit: num(p.purchase_limit, 5),
            bedrooms: num(p.bedrooms, 1), bathrooms: num(p.bathrooms, 1), sqm: num(p.sqm, 0),
            image_url: p.image_url || null, description: p.description || null,
            amenities: Array.isArray(p.amenities) ? p.amenities : [],
            status: p.status || 'live', sort_order: num(p.sort_order, 99)
          };
          if (!row.name || row.price <= 0 || row.daily_yield <= 0) throw new Error('Name, price and daily yield are required.');
          if (row.duration_days <= 0 || row.purchase_limit <= 0) throw new Error('Income drops and purchase limit must be greater than zero.');
          if (!unitStatuses.has(row.status)) throw new Error('Invalid residence status.');
          const { data, error } = await sb.from('units').insert(row).select().single();
          if (error) throw new Error(error.message);
          return ok(res, { unit: data, message: 'Residence published.' });
        }

        case 'update_unit': {
          if (!p.id) throw new Error('Residence id required.');
          const patch = {};
          ['name', 'tier', 'image_url', 'description', 'status'].forEach(k => { if (p[k] !== undefined) patch[k] = p[k]; });
          ['price', 'daily_yield', 'duration_days', 'purchase_limit', 'bedrooms', 'bathrooms', 'sqm', 'sort_order']
            .forEach(k => { if (p[k] !== undefined) patch[k] = num(p[k]); });
          if (Array.isArray(p.amenities)) patch.amenities = p.amenities;
          if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Residence name is required.');
          if (patch.status !== undefined && !unitStatuses.has(patch.status)) throw new Error('Invalid residence status.');
          for (const key of ['price', 'daily_yield', 'duration_days', 'purchase_limit']) if (patch[key] !== undefined && patch[key] <= 0) throw new Error('Price, income, duration and purchase limit must be greater than zero.');
          const { error } = await sb.from('units').update(patch).eq('id', p.id);
          if (error) throw new Error(error.message);
          return ok(res, { message: 'Residence updated.' });
        }

        case 'unit_status':
          await sb.from('units').update({ status: p.status }).eq('id', p.id);
          return ok(res, { message: 'Status set to ' + p.status + '.' });

        case 'delete_unit':
          await sb.from('units').update({ status: 'deleted' }).eq('id', p.id);
          return ok(res, { message: 'Residence removed from the catalogue.' });

        case 'reorder_units':
          for (const [i, id] of (p.order || []).entries())
            await sb.from('units').update({ sort_order: i }).eq('id', id);
          return ok(res, { message: 'Catalogue order saved.' });

        case 'save_settings': {
          if (p.withdrawal_days !== undefined && !validDays(p.withdrawal_days)) throw new Error('Withdrawal days must be a comma-separated list of unique values from 0 to 6.');
          if (p.income_drop_days !== undefined && !validDays(p.income_drop_days)) throw new Error('Income drop days must be a comma-separated list of unique values from 0 to 6.');
          if (p.withdrawal_mode !== undefined && !withdrawalModes.has(String(p.withdrawal_mode))) throw new Error('Withdrawal mode must be gateway, review, or manual.');
          const rows = Object.entries(p).map(([key, value]) => ({ key, value: String(value) }));
          if (!rows.length) throw new Error('Nothing to save.');
          const { error } = await sb.from('settings').upsert(rows, { onConflict: 'key' });
          if (error) throw new Error(error.message);
          await sb.from('audit_log').insert({ actor: actor.id, action: 'save_settings', meta: p });
          return ok(res, { message: 'Settings saved and live across the site.' });
        }

        case 'reply_ticket':
          await sb.from('support_tickets').update({
            admin_reply: p.reply, status: 'answered', replied_at: new Date().toISOString()
          }).eq('id', p.id);
          return ok(res, { message: 'Reply sent.' });

        case 'run_sweep': {
          const { data, error } = await sb.rpc('sweep_income', { p_limit: 250 });
          if (error) throw new Error(error.message);
          const r = Array.isArray(data) ? data[0] : data;
          await sb.from('cron_runs').insert({
            scanned: r?.scanned || 0, drops_paid: r?.drops_paid || 0, amount_paid: r?.amount_paid || 0,
            leases_completed: r?.leases_completed || 0, remaining: r?.remaining || 0, ok: true
          });
          return ok(res, { sweep: r, message: 'Income sweep completed.' });
        }

        default:
          throw new Error('Unknown action.');
      }
    }

    return fail(res, 'Method not allowed.', 405);
  } catch (e) {
    const m = e.message || String(e);
    return fail(res, e, /Unauthorized/.test(m) ? 401 : /Forbidden/.test(m) ? 403 : 400);
  }
}
