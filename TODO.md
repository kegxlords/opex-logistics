# Tranex Dispatch Terminal redesign

## Member application surfaces
- Replace the CSC member UI's visual identity with Tranex across member-facing pages: use the dark, angular night-time logistics dispatch-office direction; asphalt and matte panels; Lane Amber `#FFB020`, Amber-hot `#FF8A00`, Route Teal `#17C3B2`, Go Green `#3DDC7A`, Hazard Red `#FF4D4F`, Signal Blue `#4DA3FF`, Marking White `#F2F5F7`, and Fog `#9AA7B4` / `#6C7A89`; use Barlow Condensed 600/700 for uppercase headings, Barlow for body text, and IBM Plex Mono 500/600 for amounts, references, countdowns, codes, and timestamps.
- Apply the Dispatch Terminal visual language across member pages and the admin interface, keeping the surfaces angular rather than soft and rounded. Include status lamps beside monospace status words, restrained short mechanical transitions, and respect reduced-motion preferences.
- Use a fixed dispatch bar with Tranex mark, live WAT clock and next-drop countdown, care and activity controls; use a labelled five-stop desktop icon rail and mobile bottom ticket-stub navigation bar for Board, Packages, Fleet, Crew and Account, with no Garage/transactions stop in the footer.
- Group the member directory links on the profile page into clear Operations, Funds & records, Crew & support, and Session sections, keeping the transaction ledger reachable from the profile directory.
- Remove the top profile card and Account details panel from the profile page while retaining the account statistics, member directory, and community/care links.
- Keep member pages usable at desktop and mobile sizes and preserve their existing page access, responsive behavior, and authentication/session handling.

## Member dashboard, fleet, and transaction surfaces
- Redesign the dashboard as an asymmetric Tranex control tower, visually distinct from the former CSC dashboard; retain wallet balances, quick actions, active funding routes and member manifest, and replace the package list with a dedicated-page call to action.
- Have the dashboard Deposit, Withdraw, and Check-In action tiles navigate to their respective existing pages instead of opening pop-up sheets.
- Move the complete lease package catalogue from the dashboard to a dedicated Packages page, add Packages to the member footer navigation without restoring Garage, and retain each package's existing details and purchase confirmation flow.
- Present the dedicated fleet catalogue and active-funding list as split-flap/departure boards, with plan or residence, fund, per-24-hour amount, days, total, and status lamp; rows should settle in with a brief flip treatment and collapse to a readable two-line mono layout on mobile.
- Present each active funding as a route line from funded origin to completed payout destination, with its progress marker positioned from actual progress and a next-drop countdown. At term end, show a red status and the wording `OUT OF DISPATCH DAYS`.
- Style confirmations, receipts, plan details, and transaction actions as ticket stubs with notched edges, perforation, and hazard-stripe header bands. Render caps and limits with 45° amber/black hazard stripes; signal withdrawal windows with an open/closed lamp and mono hours.
- Apply the Tranex visual system to login, registration, password recovery, account, deposit, withdrawal, leases, referrals, team, support, bank-card, check-in, and transaction pages without changing their existing data or business rules.
- Redesign registration to require email and password only, with invitation code optional; remove the full-name field and CAPTCHA UI and checks, and do not alter Supabase unless a schema requirement is found.

## Admin interface
- Redesign the admin console and member dossier in the same Tranex Dispatch Terminal language: dark operations panels, angular data tables, mono metrics and timestamps, amber active navigation and status lamps, hazard-style destructive or limit states, and clear responsive behavior.
- Preserve all existing administrator functions, including overview, member lookup/detail/preview, deposit and withdrawal review, residence catalogue, settings, income sweep, and sign-out.

## Behavior and safety
- Keep existing authentication, password recovery, membership, deposit, withdrawal, lease, income, referral, support, and administrator flows and their data contracts intact; change presentation and visible UI branding only, except for adding read-only dashboard views of existing lease data required by the brief.
- Do not change existing active lease terms, server/database data, or financial calculations as part of this visual redesign.
