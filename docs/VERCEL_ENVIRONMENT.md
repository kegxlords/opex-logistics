# Vercel environment variables

Add these variables in Vercel project settings. Enter the real values in Vercel; never commit them to Git. The cPanel PHP relay is intentionally stateless: it stores no MGM credentials and uses the cPanel outbound IP to call MGM Pay.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by API routes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key. Never expose it in browser code. |
| `CRON_SECRET` | Secret required by the scheduled income-sweep endpoint. |
| `MGM_PROXY_URL` | HTTPS URL of the uploaded `mgm-gateway-proxy.php` file on cPanel. |
| `MGM_PROXY_SHARED_SECRET` | Long random secret used to authenticate Vercel-to-cPanel relay requests. Put the same value into the relay's `PROXY_SHARED_SECRET` constant. |
| `MGM_PAY_BASE_URL` | `https://api.mgm-paysandbox.com` for sandbox or `https://api.mgm-pay.com` for production. |
| `MGM_PAY_MERCHANT_NO` | MGM Pay merchant number. |
| `MGM_PAY_APP_ID` | MGM Pay API AppId, not the documentation-site login. |
| `MGM_PAY_COLLECTION_KEY` | MGM Pay collection signing secret for deposits. |
| `MGM_PAY_PAYOUT_KEY` | MGM Pay payout signing secret for withdrawals. |
| `MGM_PAY_DEPOSIT_NOTIFICATION_URL` | Public HTTPS callback URL for deposit status updates, e.g. `https://your-domain/api/webhooks/mgm?type=deposit`. |
| `MGM_PAY_WITHDRAWAL_NOTIFICATION_URL` | Public HTTPS callback URL for withdrawal status updates, e.g. `https://your-domain/api/webhooks/mgm?type=withdrawal`. |
| `MGM_PAY_SUCCESS_REDIRECT_URL` | Customer return URL after MGM Pay checkout. |

The relay file is [`cpanel/mgm-gateway-proxy.php`](../cpanel/mgm-gateway-proxy.php). Upload it to HTTPS cPanel hosting, replace only `PROXY_SHARED_SECRET`, and confirm PHP cURL is enabled. Do not put MGM merchant numbers or MGM keys in that file; Vercel sends them over the authenticated HTTPS request. Restrict the relay URL if your hosting supports IP allowlisting, and use a separate sandbox relay while testing.

Deposits use MGM Pay `POST /api/pay/payment` with `BANK_CARD` and `REDIRECT`; the member is sent to the returned cashier URL. Withdrawals use `POST /api/settle/settlement` with a Nigerian bank code. MGM’s signed request is made from cPanel, not Vercel. An MGM `state: ok` response means accepted for processing, not paid: withdrawals remain pending and funds remain locked until a verified callback or reconciliation endpoint settles them.

The secure default is `review`. `gateway` submits immediately; `review` submits only after an administrator approves the queue item; `manual` never calls MGM Pay and lets an administrator mark the withdrawal paid locally.
