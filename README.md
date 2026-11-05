# BetTrack

A personal balance tracker and calculator for recording your own betting rounds. You tap WIN or LOSE after each round; BetTrack recomputes your balance, statistics and history. Everything runs in your browser. There is no backend, no login and no API key.

Repository: <https://github.com/rachata295-code/bettrack>

## What it is, and what it is not

**It is** a bookkeeping tool: a calculator plus a ledger of rounds you enter yourself.

**It is not**:

- connected to any betting site, and it never places bets or automates anything;
- a predictor. It makes no claim about future outcomes and offers no "winning strategy";
- a source of advice to raise or lower your bet based on streaks. Every round is independent.

## Disclaimer

> Outcomes are uncertain. Past results do not predict future rounds. Figures here are your own records, not funds held on any platform. · ผลการเล่นไม่แน่นอน ผลในอดีตไม่ได้ทำนายรอบถัดไป

## Features

- Dashboard: current balance, net P&L, ROI, highest/lowest, quick WIN/LOSE buttons, compact balance chart, Today / This week P&L (all sessions of the current currency), Bankroll Guard status and session statistics
- Calculator: live preview of win/lose outcome, input validation, double-press protection, undo/redo
- Keyboard shortcuts: `W`, `L`, `U`, `B`, `M`, `?`
- History: search, sort, edit, delete, undo, CSV export; rows whose bet exceeded the balance at that time are flagged. Date filters use Bangkok time (`Asia/Bangkok`)
- Sessions: create, rename, switch, delete; JSON backup export and import
- Settings: display precision (0 to 8 decimals) and data management
- Money is handled as decimal strings (decimal.js), never floating point; rounding only happens when displaying
- Calculator multiplier quick-pick chips next to the free-form multiplier field

### Bankroll Guard

Guard is a set of warnings and suggestions about your own bankroll, configured in **Settings**. It never changes your bet for you and it does not predict anything: a suggestion is only a sizing rule (a percentage of your balance), and every round stays independent.

- Suggested bet (percent of balance or fixed) with a "Use" button, and a risk level (low/medium/high) for the bet you typed
- Loss-streak alert with an optional break (soft banner or hard cooldown countdown)
- Per-session stop-loss and take-profit, plus a daily loss limit across sessions of the same currency; reaching one asks you to confirm before recording
- Chasing alert when a bet is raised right after a loss

### Analytics

- Balance chart per session with a start-balance reference line
- Risk tools (math aids, not predictions): break-even win rate for your multiplier; expected value per round and the chance of at least one win in k rounds, both computed at *your own* win-probability estimate; and a break-even calculator showing how many winning rounds would recover a loss. Recovering a loss is never guaranteed
- Daily, weekly and monthly breakdowns with previous-period comparison. Periods use Bangkok time (`Asia/Bangkok`), weeks start on Monday, and sessions of different currencies are never mixed
- Calendar heatmap of daily P&L, with a day detail sheet
- CSV export of period summaries

## Roadmap

- **M3: Extras** wallet and real P&L, currency and fees, Monte Carlo simulator, PWA

## Getting started

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Static export build (output in `out/`) |
| `pnpm typecheck` | TypeScript check (`tsc --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:coverage` | Tests with coverage for `lib/` |

## Project structure

```
app/            Next.js App Router pages ((app)/ holds Dashboard, Calculator, History, Analytics, Sessions, Settings)
components/     UI: layout/, dashboard/, calculator/, guard/, charts/, analytics/, history/, sessions/, ui/ (shadcn)
hooks/          React hooks (timeline, guard, recording rounds, shortcuts)
lib/            Pure logic, no React: calculations/ (money, round, timeline, stats, guard, chasing, periods, series, calendar, risk), io/ (backup, CSV)
store/          Zustand stores and localStorage persistence
types/          Shared TypeScript types
tests/          Vitest tests
```

## Your data and backups

All data stays in your browser's `localStorage` under the keys `bettrack:v1:bets` and `bettrack:v1:settings`. Clearing site data, or using another browser or device, means the data will not be there.

To back up, open **Sessions** and use the JSON export; to restore, use import on the same page. History can also be exported as CSV. Export a backup regularly.

## Wallet

The **Wallet** page records your real deposits and withdrawals (with fees, in Bangkok time) and shows your real result: Net = withdrawals − deposits − fees + on platform. Amounts in other currencies are converted only with exchange rates you enter in Settings. It also includes a withdrawal calculator. Wallet data is stored under `bettrack:v1:wallet`.

## Deploy to Vercel

1. In Vercel choose **Add New... > Project > Import Git Repository** and pick this repo.
2. Framework preset: **Next.js** (detected automatically).
3. Click **Deploy**. No environment variables are needed.

## สรุปภาษาไทย

BetTrack คือเครื่องคิดยอดเงินและสมุดบันทึกผลการเล่นส่วนตัว คุณกด WIN/LOSE เอง แอปคำนวณยอดคงเหลือและสถิติให้ ข้อมูลอยู่ใน localStorage ของเบราว์เซอร์เท่านั้น (ไม่มี backend) แอปนี้ไม่เชื่อมต่อเว็บพนัน ไม่ทำนายผล และไม่ใช่คำแนะนำทางการเงิน มี Bankroll Guard ที่เป็นเพียงการเตือนและข้อเสนอแนะขนาดเดิมพัน (ไม่ใช่การทำนาย และไม่เปลี่ยน bet ให้เอง) และหน้า Analytics (กราฟ ยอดรายวัน/สัปดาห์/เดือนตามเวลาไทย ปฏิทิน และ CSV) ควร export backup เป็นประจำที่หน้า Sessions

## License

[MIT](./LICENSE)
