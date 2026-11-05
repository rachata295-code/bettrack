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

## Features (M1)

- Dashboard: current balance, net P&L, ROI, highest/lowest, quick WIN/LOSE buttons and session statistics
- Calculator: live preview of win/lose outcome, input validation, double-press protection, undo/redo
- Keyboard shortcuts: `W`, `L`, `U`, `B`, `M`, `?`
- History: search, sort, edit, delete, undo, CSV export; rows whose bet exceeded the balance at that time are flagged
- Sessions: create, rename, switch, delete; JSON backup export and import
- Settings: display precision (0 to 8 decimals) and data management
- Money is handled as decimal strings (decimal.js), never floating point; rounding only happens when displaying

## Roadmap

- **M2: Analytics and Bankroll Guard** balance chart, daily/weekly/monthly analytics, bankroll guard warnings, risk tools, fuller dashboard
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
app/            Next.js App Router pages ((app)/ holds Dashboard, Calculator, History, Sessions, Settings)
components/     UI: layout/, dashboard/, calculator/, history/, sessions/, ui/ (shadcn)
hooks/          React hooks (timeline, recording rounds, shortcuts)
lib/            Pure logic, no React: calculations/ (money, round, timeline, stats), io/ (backup, CSV)
store/          Zustand stores and localStorage persistence
types/          Shared TypeScript types
tests/          Vitest tests
```

## Your data and backups

All data stays in your browser's `localStorage` under the keys `bettrack:v1:bets` and `bettrack:v1:settings`. Clearing site data, or using another browser or device, means the data will not be there.

To back up, open **Sessions** and use the JSON export; to restore, use import on the same page. History can also be exported as CSV. Export a backup regularly.

## Deploy to Vercel

1. In Vercel choose **Add New... > Project > Import Git Repository** and pick this repo.
2. Framework preset: **Next.js** (detected automatically).
3. Click **Deploy**. No environment variables are needed.

## สรุปภาษาไทย

BetTrack คือเครื่องคิดยอดเงินและสมุดบันทึกผลการเล่นส่วนตัว คุณกด WIN/LOSE เอง แอปคำนวณยอดคงเหลือและสถิติให้ ข้อมูลอยู่ใน localStorage ของเบราว์เซอร์เท่านั้น (ไม่มี backend) แอปนี้ไม่เชื่อมต่อเว็บพนัน ไม่ทำนายผล และไม่ใช่คำแนะนำทางการเงิน ควร export backup เป็นประจำที่หน้า Sessions

## License

[MIT](./LICENSE)
