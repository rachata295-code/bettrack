# BetTrack M2 (Analytics + Bankroll Guard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่มเลือก multiplier แบบเร็ว, Bankroll Guard (แนะนำ/เตือนเท่านั้น), risk tools, กราฟ balance และหน้า Analytics รายวัน/สัปดาห์/เดือน พร้อม Dashboard เต็มรูปแบบ

**Architecture:** ต่อยอด M1 แนวทาง A: logic ใหม่ทั้งหมดเป็น pure function ใน `lib/calculations/` (`periods`, `guard`, `risk`, `series`, `multipliers`) ที่รับ rounds/timeline แล้วคำนวณใหม่ทุกครั้ง UI อ่านผ่าน hook ที่ memoize; settings ของ guard อยู่ใน settings-store (bump version 2 + migrate) และ limit ต่อ session อยู่ใน `Session.guard`

**Tech Stack:** เดิมจาก M1 + `recharts@3`, `date-fns@4`, `@date-fns/tz@1`

**Spec:** `PLAN.md` — §4 (Bankroll Guard), §5 (risk tools ยกเว้น Monte Carlo), §6.1–6.2 (Analytics), §8 (Dashboard/Navigation), §10 (tests). คำขอเพิ่มจากผู้ใช้ (2026-11-05): ปุ่มเลือก multiplier ที่เคยใช้แบบเร็ว เผื่อบางตา cash out ได้สูงกว่าปกติ

## Global Constraints

- Branch `m2-analytics` แตกจาก `m1-mvp` (M1 ยังไม่ merge) ทุก commit ลงท้าย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- กติกาทั้งหมดใน Global Constraints ของ M1 (`docs/plans/2026-11-04-m1-mvp.md`) ยังบังคับใช้: เงินเป็น decimal string, ห้ามคำนวณเงินนอก `lib/`, เครื่องหมาย +/− (U+2212) เสมอ, `lib/` ห้าม import React/Next/store, ไม่มีปุ่ม placeholder, Disclaimer อยู่ใน AppShell ที่เดียว (R6) ห้ามเพิ่ม
- ข้อยกเว้นเดียวของ "ห้ามใช้ number กับเงิน": ข้อมูลที่ส่งให้ Recharts แปลงเป็น `number` ได้ที่ `lib/calculations/series.ts` เท่านั้น
- Timezone สำหรับวัน/สัปดาห์/เดือน = `Asia/Bangkok` (`APP_TZ` ใน `lib/calculations/periods.ts`), สัปดาห์เริ่มวันจันทร์ (ISO week), key รูปแบบ `2026-11-04` / `2026-W45` / `2026-11`
- **สกุลเงินไม่ปนกัน:** analytics ข้าม session และ daily loss limit รวมเฉพาะ session ที่ currency เดียวกัน (ค่าเริ่มต้น = currency ของ session ที่ active)
- Guard **แนะนำและเตือนเท่านั้น** ห้ามเปลี่ยน bet ให้เอง ข้อความห้ามสื่อว่ารอบหน้ามีโอกาสชนะมากขึ้นหรือมี "จังหวะ" ใดๆ ห้ามมี analytics แบบ "ชั่วโมง/วันไหนชนะบ่อย"
- ค่าเริ่มต้น Guard: sizing `{ mode: 'percent', percent: '10', minBet: '0.1' }`, riskBands `{ low: '5', high: '20' }`, lossStreak `{ enabled: true, n: 3, mode: 'soft', cooldownMin: 5 }`, `dailyLossLimit` ไม่ตั้ง, `chasingAlert: true`
- shadcn base-nova (Base UI): ใช้ `render=` ไม่ใช่ `asChild`; Next 16 ดู `node_modules/next/dist/docs/` เมื่อไม่แน่ใจ
- ข้อความ UI ภาษาอังกฤษ ข้อความเตือนสำคัญมีภาษาไทยกำกับได้

## Review Focus

1. **ข้ามเที่ยงคืนเวลาไทย:** รอบเวลา `2026-11-04T16:59:00Z` (23:59 BKK) กับ `2026-11-04T17:01:00Z` (00:01 BKK) ต้องอยู่คนละวัน และเครื่องผู้ใช้ที่ตั้ง timezone อื่นต้องได้ผลเดียวกัน → Task 2
2. **session ต่างสกุลเงิน** ต้องไม่ถูกรวม P&L กัน → Task 2 (`collectRows` filter) + Task 8
3. **hard cooldown หลัง refresh** ยังล็อกอยู่ และหมดเวลาแล้วปลดล็อกเองโดยไม่ต้อง refresh → Task 4/5
4. **settings เก่า (version 1) จาก M1** ต้องโหลดได้และได้ guard ค่าเริ่มต้น ไม่ขึ้นหน้า recovery; backup ไฟล์จาก M1 (ไม่มี `guard`) ต้อง import ได้ → Task 4
5. **multiplier chips:** ค่าเดียวกันเขียนต่างกัน (`2`, `2.0`, `2.00`) ต้องเป็น chip เดียว และ chip ต้องไม่เปลี่ยน multiplier ของรอบเก่า → Task 1

---

## File Structure

```
lib/calculations/multipliers.ts   recentMultipliers
lib/calculations/periods.ts       APP_TZ, periodKey, dateKey, collectRows, filterRange, bucketize, summarize, comparePeriods
lib/calculations/guard.ts         suggestedBet, riskBand, currentLossStreak, chasingFlags, limitStatus, todayPnl
lib/calculations/risk.ts          breakEvenWinRate, evPerRound, probAtLeastOneWin, breakEvenRounds, parseProbability
lib/calculations/series.ts        balanceSeries, bucketSeries (number conversion for charts)
lib/io/period-csv.ts              bucketsToCsv
types/index.ts                    + GuardSettings, SessionGuardLimits, LimitValue, Session.guard?
store/settings-store.ts           + guard (version 2, migrate)
store/bet-store.ts                + cooldownUntil, startCooldown, clearCooldown; updateSession รับ guard
hooks/use-guard.ts                สถานะ guard ของ session ที่ active + gate ก่อนบันทึก
hooks/use-guarded-record.ts       ห่อ useRecordRound + guard gate + chasing toast
hooks/use-analytics.ts            rows/buckets ตาม filter
components/calculator/multiplier-chips.tsx
components/guard/                 suggested-bet, risk-badge, streak-banner, limit-dialog, guard-settings-form, guard-status-card
components/charts/                balance-chart, pnl-bar-chart, calendar-heatmap
components/analytics/             session-tab, period-tab, period-filters, compare-cards, period-table, day-sheet, risk-tools
app/(app)/analytics/page.tsx
components/layout/nav-items.ts, bottom-nav.tsx, more-sheet.tsx
```

---

### Task 1: Multiplier quick-pick chips

**Files:**
- Create: `lib/calculations/multipliers.ts`, `components/calculator/multiplier-chips.tsx`, `tests/lib/multipliers.test.ts`
- Modify: `app/(app)/calculator/page.tsx` (ใต้ BetForm), `components/history/edit-round-dialog.tsx` (ใต้ช่อง multiplier)

**Interfaces:**
- Produces: `recentMultipliers(sessions: readonly Session[], opts: { defaultMultiplier: string; limit?: number /* default 6 */ }): string[]`
  - คืน default เป็นตัวแรกเสมอ ตามด้วย multiplier ที่ไม่ซ้ำ (เทียบด้วยค่า Decimal) จากทุก round ทุก session เรียงจาก `createdAt` ล่าสุดก่อน, รวมไม่เกิน `limit` ตัว, ค่าที่คืนเป็นรูป normalize (`new Decimal(x).toString()`)
- Produces: `<MultiplierChips value={string} defaultMultiplier={string} options={string[]} onPick={(m: string) => void} />` — ปุ่ม chip แนวนอนเลื่อนได้, chip ที่ตรงกับ `value` (เทียบ Decimal; ถ้า value parse ไม่ได้ไม่มี chip active) มี `aria-pressed="true"`, chip แรกมีป้าย "Default", แต่ละ chip สูง ≥ 40px, แสดงเป็น `2.03x`

- [ ] **Step 1: test ที่ fail**

```ts
const s = (rounds: Array<[string, string]>): Session => ({ ...baseSession, rounds: rounds.map(([m, t]) => ({ id: m + t, result: 'win', bet: '4', multiplier: m, createdAt: t })) });
it('default first, then most recent distinct', () => {
  const a = s([['2.03', '2026-11-01T00:00:00Z'], ['3.5', '2026-11-03T00:00:00Z']]);
  const b = s([['5', '2026-11-02T00:00:00Z'], ['2.0', '2026-11-04T00:00:00Z']]);
  expect(recentMultipliers([a, b], { defaultMultiplier: '2.03' })).toEqual(['2.03', '2', '3.5', '5']);
});
it('dedupes equal values written differently', () => {
  const a = s([['2', '2026-11-01T00:00:00Z'], ['2.00', '2026-11-02T00:00:00Z']]);
  expect(recentMultipliers([a], { defaultMultiplier: '2.0' })).toEqual(['2']);
});
it('respects limit', () => {
  const a = s(['1.5', '2.5', '3', '4', '6', '8', '10'].map((m, i) => [m, `2026-11-0${i + 1}T00:00:00Z`] as [string, string]));
  expect(recentMultipliers([a], { defaultMultiplier: '2', limit: 4 })).toEqual(['2', '10', '8', '6']);
});
```

- [ ] **Step 2:** `pnpm test tests/lib/multipliers.test.ts` → FAIL → implement → PASS
- [ ] **Step 3:** `MultiplierChips` + ใส่ใน Calculator: `options = recentMultipliers(useBetStore(s => s.sessions), { defaultMultiplier: session.defaultMultiplier })` (memoize ด้วย sessions), `onPick = setMultiplier` (draft — ไม่แตะ session default และรอบเก่า) และใส่ใน EditRoundDialog โดย `onPick` ตั้งค่าในฟอร์มแก้ไข
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` ผ่าน; ตรวจใน browser: กด chip 3.5 → preview เปลี่ยน, กด WIN แล้วรอบนั้นบันทึก 3.5x, กด chip Default กลับเป็น 2.03
- [ ] **Step 5:** Commit: `feat: quick-pick chips for recently used multipliers`

---

### Task 2: Periods engine (Asia/Bangkok)

**Files:**
- Create: `lib/calculations/periods.ts`, `tests/lib/periods.test.ts`
- Modify: `package.json` (`pnpm add date-fns @date-fns/tz`), `lib/history-query.ts` (from/to ใช้ `dateKey` แทนวันที่ของ browser), `lib/io/backup.ts` (`isoDate` เข้มงวด: ต้องตรง `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/` และ `Date.parse` ไม่เป็น NaN — กันข้อมูลวันที่แปลกพัง bucket)

**Interfaces:**
- Consumes: `computeTimeline`, `TimelineRow`, `Session`, `Currency`
- Produces:
  ```ts
  export const APP_TZ = 'Asia/Bangkok';
  export type PeriodUnit = 'day' | 'week' | 'month';
  export function dateKey(iso: string, tz?: string): string;                 // 'YYYY-MM-DD' ในเวลา tz
  export function periodKey(iso: string, unit: PeriodUnit, tz?: string): string; // '2026-11-04' | '2026-W45' (ISO week-year) | '2026-11'
  export interface AnalyticsRow extends TimelineRow { sessionId: string; sessionName: string; chasing: boolean }
  export interface RowFilter { currency: Currency; sessionId?: string /* undefined = all */; tags?: string[] /* any-of */ }
  export function collectRows(sessions: readonly Session[], f: RowFilter): AnalyticsRow[];   // เรียง createdAt ขึ้น, tie → sessionId, index
  export type RangePreset = '7d' | '30d' | '90d' | 'all';
  export function filterRange(rows: readonly AnalyticsRow[], range: RangePreset | { from: string; to: string }, now: Date, tz?: string): AnalyticsRow[];
    // preset Nd = วันนี้ + N−1 วันก่อนหน้า (ตาม dateKey), custom from/to = YYYY-MM-DD inclusive
  export interface BucketSummary { key: string; rounds: number; wins: number; losses: number; winRatePct: string;
    wagered: Money; payouts: Money; pnl: Money; roiPct: string /* pnl/wagered*100, "0" ถ้า wagered 0 */;
    maxDrawdown: Money /* บนเส้น P&L สะสมของ bucket เริ่มที่ 0 */; chasing: number; playMinutes: number }
  export function summarize(key: string, rows: readonly AnalyticsRow[]): BucketSummary;
  export function bucketize(rows: readonly AnalyticsRow[], unit: PeriodUnit, tz?: string): BucketSummary[]; // key ขึ้น, เฉพาะ bucket ที่มีข้อมูล
  export function comparePeriods(rows: readonly AnalyticsRow[], unit: PeriodUnit, now: Date, tz?: string): { current: BucketSummary; previous: BucketSummary };
  ```
  - `chasing` ของแต่ละแถวมาจาก `chasingFlags(session.rounds)` (Task 3) — **Task 2 ใส่ `false` ไว้ก่อนผ่าน parameter** `collectRows(sessions, f, flags?: (s: Session) => boolean[])` แล้ว Task 3 ส่ง `chasingFlags` เข้ามา
  - `playMinutes` = ผลรวมช่วงห่างระหว่างแถวติดกัน (ตามเวลา) ที่ ≤ 15 นาที ปัดลงเป็นนาทีเต็ม

- [ ] **Step 1: test ที่ fail**

```ts
it('splits Bangkok midnight regardless of host TZ', () => {
  expect(dateKey('2026-11-04T16:59:00Z')).toBe('2026-11-04');
  expect(dateKey('2026-11-04T17:01:00Z')).toBe('2026-11-05');
});
it('ISO week starting Monday', () => {
  expect(periodKey('2026-11-01T10:00:00Z', 'week')).toBe('2026-W44'); // Sun 1 Nov 2026 (BKK)
  expect(periodKey('2026-11-02T10:00:00Z', 'week')).toBe('2026-W45'); // Mon
  expect(periodKey('2027-01-01T05:00:00Z', 'week')).toBe('2026-W53');
  expect(periodKey('2026-11-30T17:30:00Z', 'month')).toBe('2026-12');
});
it('collectRows excludes other currencies and filters tags', () => { /* USDT session + THB session; currency USDT → only USDT rows; tags ['x'] → only sessions tagged x */ });
it('summarize matches spec example', () => {
  // win 4@2.03, lose 4, lose 4, win 4@2.03 within one day, 5 minutes apart
  expect(summarize('d', rows)).toMatchObject({ rounds: 4, wins: 2, losses: 2, winRatePct: '50', wagered: '16',
    payouts: '16.24', pnl: '0.24', roiPct: '1.5', maxDrawdown: '8', playMinutes: 15 });
});
it('playMinutes ignores gaps over 15 minutes', () => { /* times 10:00, 10:10, 11:00, 11:05 → 15 */ });
it('filterRange 7d includes today and 6 days back (BKK)', () => { /* now 2026-11-05T03:00Z; rows on 10-29 (out) and 10-30 (in) */ });
it('comparePeriods returns empty summaries when no rows', () => { /* rounds 0, pnl '0' */ });
it('history from/to uses Bangkok dates', () => { /* queryHistory row at 2026-11-04T17:30Z with from=to='2026-11-05' → included */ });
it('rejects lenient dates in backup', () => expect(parseBackup(withCreatedAt('1')).ok).toBe(false));
```

- [ ] **Step 2:** FAIL → `pnpm add date-fns @date-fns/tz` → implement (ใช้ `TZDate`/`tz()` จาก `@date-fns/tz` กับ `format(..., "RRRR-'W'II")`) → PASS
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test` ผ่าน
- [ ] **Step 4:** Commit: `feat: Bangkok-time period bucketing and stricter backup dates`

---

### Task 3: Guard and risk calculations

**Files:**
- Create: `lib/calculations/guard.ts`, `lib/calculations/risk.ts`, `tests/lib/guard.test.ts`, `tests/lib/risk.test.ts`
- Modify: `types/index.ts` (เพิ่ม `GuardSettings`, `SessionGuardLimits`, `LimitValue` ตาม PLAN.md §4 และ `Session.guard?: SessionGuardLimits`), `lib/calculations/periods.ts` (default `flags` = `chasingFlags`)

**Interfaces:**
- Produces (`guard.ts`):
  ```ts
  export const DEFAULT_GUARD: GuardSettings; // ค่าตาม Global Constraints
  export function suggestedBet(balance: Money, sizing: GuardSettings['sizing'], precision: number): Money | null;
    // mode 'fixed' → null; percent → max(minBet, ROUND_DOWN(balance × percent/100, precision)) แต่ไม่เกิน balance; balance ≤ 0 → null
  export type RiskLevel = 'low' | 'medium' | 'high';
  export function riskBand(bet: Money, balance: Money, bands: GuardSettings['riskBands']): { pct: string; level: RiskLevel } | null; // null ถ้า balance ≤ 0
  export function currentLossStreak(rounds: readonly Round[]): number;           // จำนวน lose ติดกันท้ายสุด
  export function chasingFlags(rounds: readonly Round[]): boolean[];            // [i] = rounds[i-1] lose && bet[i] > bet[i-1]
  export function wouldChase(rounds: readonly Round[], nextBet: Money): boolean; // สำหรับเตือนก่อน/หลังบันทึก
  export function resolveLimit(limit: LimitValue, initialBalance: Money): Money;  // amount → value; percent → initial × value/100
  export type LimitHit = 'stop_loss' | 'take_profit' | 'daily_loss';
  export function limitHits(input: { initialBalance: Money; balance: Money; limits?: SessionGuardLimits; todayPnl: Money; dailyLossLimit?: Money }): LimitHit[];
    // stop_loss: initial − balance ≥ limit; take_profit: balance − initial ≥ limit; daily_loss: −todayPnl ≥ dailyLossLimit
  export function todayPnl(sessions: readonly Session[], currency: Currency, now: Date, tz?: string): Money; // ใช้ collectRows + dateKey
  ```
- Produces (`risk.ts`):
  ```ts
  export function breakEvenWinRate(multiplier: string): string;                     // 1/m*100, ไม่ปัด
  export function parseProbability(raw: string): { ok: true; value: string } | { ok: false }; // รับ "48.77" เป็น % → "0.4877"; ต้อง 0 < p < 1
  export function evPerRound(bet: Money, p: string, multiplier: string): Money;     // bet × (p × m − 1)
  export function probAtLeastOneWin(p: string, k: number): string;                  // 1 − (1−p)^k
  export function breakEvenRounds(loss: Money, bet: Money, multiplier: string): number | null; // ceil(loss / (bet×(m−1))); null ถ้า loss ≤ 0
  ```

- [ ] **Step 1: test ที่ fail** (ค่าจาก spec)

```ts
expect(suggestedBet('16.99', { mode: 'percent', percent: '10', minBet: '0.1' }, 2)).toBe('1.69');
expect(suggestedBet('0.5', { mode: 'percent', percent: '10', minBet: '0.1' }, 2)).toBe('0.1');
expect(suggestedBet('0.05', { mode: 'percent', percent: '10', minBet: '0.1' }, 2)).toBe('0.05'); // capped at balance
expect(riskBand('4', '16.99', { low: '5', high: '20' })).toMatchObject({ level: 'high' });
expect(riskBand('0.5', '16.99', { low: '5', high: '20' })!.level).toBe('low');
expect(currentLossStreak(rounds('W','L','L','L'))).toBe(3);
expect(chasingFlags(bets([['L','4'],['W','8'],['L','4'],['L','4']]))).toEqual([false, true, false, false]);
expect(limitHits({ initialBalance: '16.99', balance: '6.99', limits: { stopLoss: { kind: 'amount', value: '10' } }, todayPnl: '-10' })).toEqual(['stop_loss']);
expect(limitHits({ initialBalance: '100', balance: '120', limits: { takeProfit: { kind: 'percent', value: '20' } }, todayPnl: '20' })).toEqual(['take_profit']);
expect(limitHits({ initialBalance: '100', balance: '95', todayPnl: '-5', dailyLossLimit: '5' })).toEqual(['daily_loss']);
expect(breakEvenWinRate('2.03').startsWith('49.26')).toBe(true);
expect(evPerRound('4', '0.4877', '2.03')).toBe('-0.039876');
expect(probAtLeastOneWin('0.5', 3)).toBe('0.875');
expect(breakEvenRounds('8', '4', '2.03')).toBe(2);
expect(parseProbability('48.77')).toEqual({ ok: true, value: '0.4877' });
expect(parseProbability('100').ok).toBe(false);
```

- [ ] **Step 2:** FAIL → implement → PASS; ใส่ `chasingFlags` เป็น default ของ `collectRows` แล้วเพิ่ม test ว่า `AnalyticsRow.chasing` ถูก
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test` → Commit: `feat: bankroll guard and risk calculations`

---

### Task 4: Guard state — settings, session limits, cooldown

**Files:**
- Modify: `store/settings-store.ts`, `store/bet-store.ts`, `store/storage.ts` (validation ของ settings), `lib/io/backup.ts` (`SessionSchema.guard` optional, `settings.guard` optional), `lib/session-form.ts` + `components/sessions/session-form-dialog.tsx` (ช่อง stop-loss / take-profit), `app/(app)/settings/page.tsx`
- Create: `components/guard/guard-settings-form.tsx`, tests ใน `tests/store/*.test.ts`, `tests/lib/session-form.test.ts`, `tests/lib/backup.test.ts`

**Interfaces:**
- settings-store: state `guard: GuardSettings` (default `DEFAULT_GUARD`), `setGuard(patch: DeepPartial<GuardSettings>): { ok: boolean }` (validate: percent 0 < x ≤ 100, minBet > 0, low < high ทั้งคู่ 0–100, n integer 2–20, cooldownMin integer 1–120, dailyLossLimit > 0 หรือ undefined), persist `version: 2`, `migrate(state, 1)` → เติม `guard: DEFAULT_GUARD`; guard ที่ invalid ตอนอ่าน → ใช้ default (ไม่ขึ้น recovery เหมือน precision)
- bet-store: `cooldownUntil: number | null` (persist), `startCooldown(minutes: number): void`, `clearCooldown(): void`; `updateSession` รับ `guard?: SessionGuardLimits | null` (null = ลบ) validate value > 0 และ percent ≤ 100
- Backup: M1 ไฟล์ที่ไม่มี guard ต้อง parse ผ่าน; `createBackup(sessions, settings)` ใส่ `settings.guard`; Replace import ที่มี settings.guard → `setGuard`
- Settings page: section "Bankroll Guard" (sizing mode/percent/minBet, risk bands, loss streak enabled/n/mode/cooldown, daily loss limit, chasing alert) พร้อมคำอธิบายสั้นว่า "Suggestions protect your balance; they do not predict outcomes."

- [ ] **Step 1: test ที่ fail:** migrate v1 → มี guard default; setGuard reject ค่าผิดโดยไม่เปลี่ยน state; cooldown persist แล้ว rehydrate ยังอยู่; updateSession guard validate; parseBackup ไฟล์ M1 (ไม่มี guard) ผ่าน; validateSessionForm stop-loss/take-profit
- [ ] **Step 2:** FAIL → implement → PASS
- [ ] **Step 3:** UI: GuardSettingsForm (validate ด้วย logic เดียวกับ store — export `validateGuardPatch` จาก `lib/calculations/guard.ts`) + ช่อง limit ใน SessionFormDialog
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → Commit: `feat: persisted bankroll guard settings, session limits and cooldown`

---

### Task 5: Guard in Calculator and Dashboard

**Files:**
- Create: `hooks/use-guard.ts`, `hooks/use-guarded-record.ts`, `components/guard/{suggested-bet,risk-badge,streak-banner,limit-dialog}.tsx`
- Modify: `app/(app)/calculator/page.tsx`, `app/(app)/page.tsx`

**Interfaces:**
- `useGuard(bet: string): { suggested: Money | null; risk: { pct: string; level: RiskLevel } | null; lossStreak: number; streakAlert: boolean /* streak ≥ n && enabled */; cooldownRemainingMs: number /* อัปเดตทุก 1 วินาทีขณะ > 0 */; hits: LimitHit[] }`
- `useGuardedRecord(bet, multiplier): { record(result): void; undo(): void; locked: boolean; pending: { result: RoundResult; hits: LimitHit[] } | null; confirm(): void; cancel(): void }`
  - ถ้า cooldown ยังไม่หมด → ไม่บันทึก
  - ถ้า `hits.length > 0` → ตั้ง `pending` (LimitDialog เปิด) — `confirm()` บันทึกจริง, `cancel()` ยกเลิก; ต้องยืนยันทุกครั้งที่ยังเกินเพดาน
  - หลังบันทึก: ถ้า `chasingAlert` และ `wouldChase` → `toast.warning("Bet raised right after a loss — consider sticking to your plan.")`; ถ้าเป็น lose แล้ว streak ถึง n และ mode `hard` → `startCooldown(cooldownMin)`
- StreakBanner (soft): "N losses in a row. Consider a short break — each round is independent; a streak does not make the next win more likely." (+ไทยสั้นๆ) ปิดได้ (ปิดจนกว่าจะแพ้รอบถัดไป)
- Hard mode: ปุ่ม WIN/LOSE disabled + นับถอยหลัง `mm:ss` + ปุ่ม "End break now" (`clearCooldown`, ต้อง confirm)
- SuggestedBet: แสดงใต้ BetForm "Suggested 1.69 (10% of balance)" + ปุ่ม "Use" → `setBet`; RiskBadge ข้างช่อง bet: "23.5% of balance" สีตาม level พร้อม icon (ไม่พึ่งสีอย่างเดียว)
- Dashboard ใช้ `useGuardedRecord` เหมือนกัน (Task 9 จะเพิ่ม GuardStatusCard)

- [ ] **Step 1:** test pure logic เพิ่มถ้าต้องมี helper ใหม่ (เช่น `formatCountdown(ms): string` ใน `lib/calculations/guard.ts` → `'04:59'`)
- [ ] **Step 2:** implement UI + hooks; W/L shortcuts ผ่าน `useGuardedRecord` เท่านั้น
- [ ] **Step 3:** ตรวจใน browser: ค่าเริ่มต้น (16.99, bet 4) เห็น "Suggested 1.69" และ badge high 23.5%; แพ้ 3 ตา → banner; ตั้ง hard 1 นาที → ปุ่มล็อก, refresh ยังล็อก, หมดเวลาปลดเอง; ตั้ง stop-loss 5 → เกินแล้วกด WIN ต้องเจอ dialog; ขึ้น bet หลังแพ้ → toast
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → Commit: `feat: bankroll guard suggestions, streak breaks and limit confirmations`

---

### Task 6: Chart series and balance chart

**Files:**
- Create: `lib/calculations/series.ts`, `tests/lib/series.test.ts`, `components/charts/balance-chart.tsx`
- Modify: `package.json` (`pnpm add recharts`)

**Interfaces:**
- `balanceSeries(initialBalance: Money, timeline: readonly TimelineRow[]): { round: number; balance: number; pnl: number; result: RoundResult | null }[]` — จุดแรก `{ round: 0, balance: Number(initial), pnl: 0, result: null }`
- `bucketSeries(buckets: readonly BucketSummary[]): { key: string; pnl: number; cumulative: number }[]` — cumulative สะสมด้วย Decimal แล้วค่อยแปลงเป็น number
- `<BalanceChart data initialBalance={number} showReference={boolean} currency precision height? />` — LineChart, X = round, Y = balance, `ReferenceLine` ที่ initial (toggle), dot สีเขียว/แดงตาม result, custom tooltip แสดง Round, Balance, Result, P&L (signed ด้วย `formatMoney` จากค่า string เดิม — ส่ง `pnlText`/`balanceText` มาใน data ด้วย), `ResponsiveContainer`, สีจาก CSS variables, ไม่มี animation เมื่อ `prefers-reduced-motion`

- [ ] **Step 1: test ที่ fail:** `balanceSeries('16.99', timeline(W,L))` → `[{round:0,balance:16.99,...},{round:1,balance:21.11,pnl:4.12,result:'win'},{round:2,balance:17.11,pnl:-4,result:'lose'}]`; `bucketSeries` cumulative `[1, -2, 0.5]` จาก pnl `['1','-3','2.5']`
- [ ] **Step 2:** FAIL → implement → PASS → BalanceChart component
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → Commit: `feat: balance chart with recharts`

---

### Task 7: Analytics page — Session tab and risk tools

**Files:**
- Create: `app/(app)/analytics/page.tsx`, `components/analytics/{session-tab,risk-tools}.tsx`
- Modify: `components/layout/nav-items.ts`, `components/layout/bottom-nav.tsx`, `components/layout/sidebar.tsx`, Create `components/layout/more-sheet.tsx`

**Interfaces / behaviour:**
- Nav: `NAV_ITEMS` เพิ่ม Analytics (`/analytics`, icon `ChartLine`) ระหว่าง History กับ Sessions; sidebar แสดงครบ 6; bottom nav = Dashboard, Calculator, History, Analytics, More (`Ellipsis`) — More เปิด Sheet ที่มีลิงก์ Sessions, Settings และ "More" active เมื่ออยู่ใน /sessions หรือ /settings
- Page: Tabs `Session` | `Period` (Period tab เติมใน Task 8 — **Task 7 ใส่แท็บ Period พร้อมเนื้อหาจริงไม่ได้ จึงยังไม่แสดงแท็บ Period** จนกว่า Task 8)
- Session tab: BalanceChart (toggle reference line), สรุปสถิติ (ใช้ `StatsGrid` เดิม), RiskTools:
  - Break-even win rate ของ multiplier ปัจจุบัน (draft) พร้อมคำอธิบาย "Mathematical break-even, not the game's actual win chance."
  - ช่อง "Your estimate of win probability (%)" (ว่างโดยค่าเริ่มต้น, ปุ่ม "Example: 1% house edge" เติม `0.99/m × 100`) → แสดง EV ต่อรอบ และ P(≥1 win in k rounds) พร้อมช่อง k (default 5)
  - Break-even calculator: loss (default = max(0, initial − current)) → จำนวนรอบชนะที่ต้องใช้ + "No outcome is guaranteed."
- Empty state เมื่อไม่มีรอบ

- [ ] **Step 1:** implement; `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- [ ] **Step 2:** ตรวจ browser 375/1280: nav 5 ช่องบนมือถือ, More เปิด Sheet, กราฟเริ่มที่รอบ 0, tooltip ถูก
- [ ] **Step 3:** Commit: `feat: analytics session tab, risk tools and navigation`

---

### Task 8: Analytics page — Period tab

**Files:**
- Create: `hooks/use-analytics.ts`, `components/analytics/{period-tab,period-filters,compare-cards,period-table,day-sheet}.tsx`, `components/charts/{pnl-bar-chart,calendar-heatmap}.tsx`, `lib/io/period-csv.ts`, `tests/lib/period-csv.test.ts`
- Modify: `app/(app)/analytics/page.tsx` (เพิ่มแท็บ Period)

**Interfaces / behaviour:**
- `useAnalytics(filter: RowFilter, range, unit): { rows: AnalyticsRow[]; buckets: BucketSummary[]; compare: {current; previous} }` memoize ด้วย sessions + filter
- Filters: currency (เฉพาะที่มี session; default = currency ของ session ที่ active), session (All / แต่ละ session ของ currency นั้น), tags (multi, any-of), range (7d/30d/90d/All/Custom from–to), unit (Day/Week/Month)
- CompareCards: This day/week/month vs previous — P&L (signed), rounds, win rate, แสดง Δ พร้อมเครื่องหมาย
- PnlBarChart: `ComposedChart` แท่ง P&L ต่อ bucket (เขียว/แดง) + เส้น cumulative
- CalendarHeatmap: grid เดือน (จันทร์–อาทิตย์), ปุ่มเลื่อนเดือน, ช่องวันสีเขียว/แดงความเข้มตาม |pnl| เทียบ max ของเดือน (4 ระดับ), วันที่ไม่มีรอบเป็นสีพื้น, แต่ละช่องเป็นปุ่มมี `aria-label` "4 Nov 2026: +4.12 USDT, 3 rounds" → กดเปิด DaySheet แสดงรายการรอบของวันนั้น (เวลา BKK, session, ผล, bet, multiplier, P&L)
- PeriodTable: คอลัมน์ Period, Rounds, W/L, Win rate, Wagered, P&L, ROI, Max DD, Chasing, Play time; sort ได้ทุกคอลัมน์; ปุ่ม Export CSV → `bucketsToCsv(buckets, unit)` (BOM, header `Period,Rounds,Wins,Losses,WinRatePct,Wagered,Payouts,PnL,ROIPct,MaxDrawdown,Chasing,PlayMinutes`, ค่าไม่ปัด) ชื่อไฟล์ `bettrack-<unit>-summary-<YYYYMMDD>.csv`
- ข้อความใต้แท็บ: "Summaries describe past records only. They do not predict future rounds."

- [ ] **Step 1: test ที่ fail:** `bucketsToCsv` header + escape + BOM
- [ ] **Step 2:** FAIL → implement → PASS → UI
- [ ] **Step 3:** ตรวจ browser: ข้อมูลหลายวัน (สร้างโดยแก้ createdAt ผ่าน import ไฟล์ทดสอบ) → day/week/month ถูก, heatmap กดวันแล้วเห็นรายการ, session THB ไม่ปนกับ USDT
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → Commit: `feat: daily, weekly and monthly analytics with calendar heatmap`

---

### Task 9: Full Dashboard, README และปิด M2

**Files:**
- Create: `components/guard/guard-status-card.tsx`
- Modify: `app/(app)/page.tsx`, `README.md`

**Behaviour:**
- Dashboard เพิ่ม: กราฟ balance ย่อ (BalanceChart สูง 160, ไม่มี reference toggle, ลิงก์ "Open analytics"), การ์ด "Today" และ "This week" (P&L signed + rounds, ใช้ `comparePeriods` ของ currency ปัจจุบัน ทุก session), GuardStatusCard (suggested bet, risk level, loss streak, cooldown ที่เหลือ, limit ที่ใกล้/ถึง เช่น "Stop-loss: 6.00 / 10.00 used")
- README: ย้าย M2 จาก roadmap เป็นฟีเจอร์, อธิบาย Bankroll Guard ว่าเป็นการเตือน ไม่ใช่การทำนาย, ปุ่ม multiplier chips, analytics + timezone ไทย
- [ ] **Step 1:** implement; `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build` ผ่าน, `lib/` ≥ 90% lines
- [ ] **Step 2:** ตรวจ browser 375/768/1280: ไม่มี scroll แนวนอน, กราฟ responsive, ทุกปุ่มใช้ keyboard ได้
- [ ] **Step 3:** Commit: `feat: full dashboard with guard status and period summaries`
