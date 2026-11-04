# BetTrack — Design Spec

> สถานะ: **Draft รอ review** · วันที่ 2026-11-04 · Repo: `rachata295-code/bettrack` (public) · ที่เก็บในเครื่อง: `~/dev/bettrack`

## 0. เป้าหมายและขอบเขต

BetTrack เป็นเครื่องคิดยอดเงินและบันทึกผลการเล่นส่วนตัว ผู้ใช้กดบันทึก Win/Lose เอง แอปคำนวณยอดคงเหลือ, สถิติ, analytics รายวัน/สัปดาห์/เดือน และช่วยคุมความเสี่ยงด้วย Bankroll Guard

**เป็น:** เครื่องมือบันทึกและคำนวณทางการเงิน ทำงานในเครื่องผู้ใช้ทั้งหมด (localStorage) ไม่มี backend, login หรือ API key

**ไม่เป็น และห้ามทำ:**
- ไม่เชื่อมต่อเว็บพนัน ไม่วางเดิมพันอัตโนมัติ ไม่มี auto-bet
- ไม่ทำนายผล และไม่อ้างว่ามีกลยุทธ์ที่กำไรแน่นอน
- ไม่แนะนำให้เพิ่มหรือลด bet จาก streak หรือ "ช่วงที่ stable" เพราะแต่ละรอบเป็นอิสระต่อกัน การปรับขนาด bet ทำได้แค่อิงยอดเงินคงเหลือเพื่อปกป้อง bankroll (ดู §4)
- ไม่มี analytics แบบ "ชั่วโมงไหนหรือวันไหนชนะบ่อย" เพราะชวนให้หา pattern ในผลที่สุ่ม
- ไม่ hardcode อัตราแลกเปลี่ยน และไม่แสดงข้อมูลแบบ real-time

ต้นฉบับ requirement ทั้งหมดอยู่ใน prompt "Project: BetTrack" (§1–17) เอกสารนี้ยึดตามนั้น และระบุส่วนที่เพิ่มหรือตัดสินใจเพิ่มเติม

## 1. Tech stack

| เรื่อง | เลือกใช้ |
|---|---|
| Framework | Next.js (App Router) + TypeScript strict, `output: 'export'` (static) |
| Styling / UI | Tailwind CSS, shadcn/ui, Lucide React, Motion (Framer Motion) |
| Charts | Recharts |
| State / persistence | Zustand + `persist` middleware → localStorage |
| Decimal | decimal.js |
| Date / timezone | date-fns + `@date-fns/tz` (Asia/Bangkok) |
| Validation | zod (import / backup / form input) |
| Test | Vitest + jsdom + @testing-library/react (เฉพาะ hook/store ที่จำเป็น) |
| Package manager | pnpm |
| CI / Deploy | GitHub Actions / Vercel |

## 2. Design system

ใช้ตามต้นฉบับ §2: dark mode เป็นค่าเริ่มต้น, โทน fintech ไม่มีธีมคาสิโน
- สี: bg `#09090B`, surface `#18181B`, elevated `#27272A`, border `#3F3F46`, text `#FAFAFA` / `#A1A1AA`, profit `#22C55E`, loss `#EF4444`, accent `#3B82F6` (ประกาศเป็น CSS variable ของ shadcn theme)
- ฟอนต์ Inter (`next/font`), ตัวเลขทั้งหมดใช้ `tabular-nums`
- Mobile-first, animation สั้นและเบา (≤200ms), รองรับ `prefers-reduced-motion`
- สีที่มีความหมาย (กำไร/ขาดทุน) ต้องมีเครื่องหมาย +/− หรือ icon กำกับด้วยเสมอ ไม่พึ่งสีอย่างเดียว

## 3. Data model และกติกาการคำนวณ (Approach A: เก็บข้อมูลดิบ แล้วคำนวณใหม่ทุกครั้ง)

### 3.1 ข้อมูลที่เก็บ

เงินและ multiplier ทุกค่าเก็บเป็น **string ของ decimal** (เช่น `"16.99"`) ห้ามเก็บเป็น `number`

```ts
type Money = string;            // decimal string
type Currency = 'USDT' | 'THB' | 'USD';

interface Round {
  id: string;                   // crypto.randomUUID()
  result: 'win' | 'lose';
  bet: Money;
  multiplier: string;           // > 1
  createdAt: string;            // ISO 8601 (UTC)
  note?: string;
}

interface Session {
  id: string;
  name: string;
  currency: Currency;
  initialBalance: Money;
  defaultBet: Money;
  defaultMultiplier: string;
  rounds: Round[];              // ลำดับใน array = ลำดับเวลา
  tags: string[];
  guard?: SessionGuardLimits;   // stop-loss / take-profit ต่อ session (§4)
  createdAt: string;
  updatedAt: string;
}

interface Transaction {         // M3 — global ไม่ผูกกับ session
  id: string;
  type: 'deposit' | 'withdraw';
  amount: Money;
  currency: Currency;
  fee: Money;
  at: string;
  note?: string;
}

interface Settings {
  precision: number;            // default 2 (0–8)
  timezone: 'Asia/Bangkok';
  fx: { usdtThb?: string; usdThb?: string };
  fees: FeeSettings;            // §7
  guard: GuardSettings;         // §4
  realityCheck: { enabled: boolean; intervalMin: number }; // default true, 30
}
```

ค่าเริ่มต้นของ session ใหม่: initialBalance `16.99`, bet `4`, multiplier `2.03`, currency `USDT`

### 3.2 ค่าที่คำนวณ (ไม่เก็บ)

`computeTimeline(session) → TimelineRow[]` ไล่ทีละรอบตามลำดับ:

```
balanceBefore(1) = initialBalance
win : payout = bet × m ; pnl = payout − bet ; balanceAfter = balanceBefore + pnl
lose: payout = 0       ; pnl = −bet          ; balanceAfter = balanceBefore − bet
balanceBefore(n+1) = balanceAfter(n)
row.insufficient = bet > balanceBefore
```

current balance, สถิติ, กราฟ และ analytics ทั้งหมดคำนวณต่อจาก timeline ผ่าน selector ที่ memoize ด้วย reference ของ `session.rounds`

ตัวอย่างที่ต้องได้ตรงเป๊ะ: 16.99 → win (4 × 2.03) → **21.11** → lose 4 → **17.11**

### 3.3 กติกา

1. ลำดับรอบ = ลำดับใน array แก้รอบเก่าได้เฉพาะ `result`, `bet`, `multiplier`, `note` แก้ `createdAt` ไม่ได้
2. **บันทึกรอบใหม่:** บล็อกเมื่อ bet ≤ 0, multiplier ≤ 1, input ไม่ใช่ตัวเลข หรือ bet > current balance
3. **แก้หรือลบรอบเก่า:** ทุกอย่างคำนวณใหม่อัตโนมัติ ถ้าทำให้รอบถัดไปมี `insufficient` จะยังเก็บไว้ แต่แสดงคำเตือนสีแดงที่แถวนั้นและที่ dashboard
4. เก็บทศนิยมเต็มความละเอียด ปัดเฉพาะตอนแสดงผลตาม `settings.precision` ใช้ `ROUND_HALF_UP` ส่วน suggested bet ปัดลง (`ROUND_DOWN`)
5. แก้ `initialBalance`, `defaultBet` หรือ `defaultMultiplier` ของ session ได้ โดยรอบเก่ายังใช้ bet และ multiplier ของตัวเอง
6. Bet และ multiplier บนหน้า Calculator คงเดิมจนกว่าผู้ใช้จะเปลี่ยน ระบบไม่เปลี่ยนให้เอง

### 3.4 Persistence

- Zustand `persist` เก็บใน key `bettrack:v1` มี `schemaVersion: 1` และฟังก์ชัน `migrate`
- แยกเป็น 3 store: `bet-store` (sessions, activeSessionId), `settings-store`, `wallet-store`
- รอ hydrate ก่อนแสดงผล: ระหว่างนั้นแสดง skeleton (`useHydrated`)
- error handling:
  - เขียนไม่ได้ (quota หรือ privacy mode): ขึ้น toast error และแนะนำให้ export backup
  - ข้อมูลอ่านไม่ได้หรือ zod ไม่ผ่าน: แสดงหน้า recovery ให้ดาวน์โหลดข้อมูลดิบหรือรีเซ็ต **ห้ามลบข้อมูลเองโดยไม่ถาม**

## 4. Bankroll Guard (แนะนำและเตือนเท่านั้น)

```ts
interface GuardSettings {
  sizing: { mode: 'fixed' | 'percent'; percent: string; minBet: string }; // default percent 10, minBet 0.1
  riskBands: { low: string; high: string };                // default 5 / 20 (% ของยอด)
  lossStreak: { enabled: boolean; n: number; mode: 'soft' | 'hard'; cooldownMin: number }; // true, 3, soft, 5
  dailyLossLimit?: Money;                                  // รวมทุก session ตามวันเวลาไทย
  chasingAlert: boolean;                                   // default true
}
interface SessionGuardLimits { stopLoss?: LimitValue; takeProfit?: LimitValue }
type LimitValue = { kind: 'amount' | 'percent'; value: string };
```

1. **Suggested bet** (mode `percent`) = max(minBet, ROUND_DOWN(currentBalance × percent/100)) และต้องไม่เกิน current balance แสดงข้างช่อง bet พร้อมปุ่ม "ใช้ค่านี้" ตัวอย่าง: ยอด 16.99, 10% → **1.69**
2. **Risk badge:** bet % ของยอด ≤ low แสดงสีเขียว, ≤ high สีเหลือง, > high สีแดง
3. **แพ้ติด N ตา:**
   - `soft`: ขึ้นแบนเนอร์ให้พัก
   - `hard`: ปุ่ม Win/Lose disabled พร้อมนับถอยหลัง `cooldownMin` (เก็บเวลาสิ้นสุดใน store เพื่อให้ refresh แล้วยังล็อกอยู่)
   - ข้อความต้องไม่สื่อว่ารอบหน้ามีโอกาสชนะมากขึ้น
4. **Stop-loss / take-profit ต่อ session** และ **daily loss limit:** เมื่อถึงเพดานจะขึ้น dialog ยืนยันก่อนบันทึกรอบถัดไป (กด "เล่นต่อ" ได้ แต่ต้องกดยืนยันทุกครั้งที่เกินเพดาน)
5. **Chasing detection:** รอบ n ถูกนับว่าไล่ทุนถ้า `result(n−1) = lose` และ `bet(n) > bet(n−1)` จะขึ้น toast ตอนบันทึก และนับจำนวนครั้งใน analytics
6. ฟังก์ชันทั้งหมดอยู่ใน `lib/calculations/guard.ts` เป็น pure function ที่รับ timeline และ settings

## 5. Risk tools

- **Break-even win rate** = 1 / m (2.03 → 49.26%) มีคำอธิบายว่าเป็นจุดเสมอตัวทางคณิตศาสตร์ ไม่ใช่โอกาสชนะจริงของเกม
- **EV ต่อรอบ** = bet × (p × m − 1) แสดงเฉพาะเมื่อผู้ใช้กรอก p (0 < p < 1)
- **P(ชนะอย่างน้อย 1 รอบใน k รอบ)** = 1 − (1 − p)^k แสดงเฉพาะเมื่อมี p
- **Break-even calculator:** ต้องชนะกี่รอบถึงชดเชยยอดที่เสีย = ceil(loss / (bet × (m − 1))) พร้อมหมายเหตุว่าไม่มีอะไรรับประกันว่าจะชนะ
- **Monte Carlo simulator (M3):**
  - input: p, bet (fixed หรือ % ของยอด), ยอดเริ่ม, จำนวนรอบ (≤ 10,000), จำนวนครั้งที่จำลอง (default 10,000)
  - ช่อง p มีตัวอย่าง "house edge 1% → p = 0.99/m" ให้กดเติมได้ แต่ไม่ใช่ค่าเริ่มต้น
  - output: P(หมดตัว = ยอดน้อยกว่า bet ของรอบถัดไป หรือ < minBet ในโหมด %), median ยอดสุดท้าย, P(จบด้วยยอด > ยอดเริ่ม), กราฟช่วง percentile 10/50/90 ต่อรอบ
  - รันใน Web Worker ใช้ RNG แบบใส่ seed ได้ (mulberry32) และกดยกเลิกได้
- **Disclaimer** แสดงตลอดที่ footer ของ Calculator, Analytics และ Simulator: ผลการเล่นไม่แน่นอน, ผลในอดีตไม่ทำนายอนาคต, ตัวเลขในแอปเป็นการบันทึกหรือจำลอง ไม่ใช่ยอดเงินจริงบนแพลตฟอร์ม

## 6. Analytics

### 6.1 Session tab
- **Balance chart:** แกน X = รอบ (เริ่มที่รอบ 0 = initial), แกน Y = balance, มีเส้น reference ที่ initial (เปิด/ปิดได้), จุดสีเขียว/แดงตามผล, tooltip แสดง balance / ผล / P&L
- **Session stats** ตามต้นฉบับ §4: current, initial, net P&L, ROI, สูงสุด/ต่ำสุด, จำนวนรอบ, ชนะ/แพ้, win rate, ยอดเดิมพันรวม, payout รวม, กำไรเฉลี่ยต่อรอบ, ชนะมากสุด/แพ้มากสุด, streak ปัจจุบัน, max drawdown (ทั้งจำนวนเงินและ %)
- Risk tools (§5)

### 6.2 Period tab (รายวัน / สัปดาห์ / เดือน)
- จัด bucket ตาม `createdAt` โดยใช้เวลา Asia/Bangkok สัปดาห์เริ่มวันจันทร์
- filter: ทุก session หรือ session ที่เลือก, tag, ช่วงเวลา (7 / 30 / 90 วัน / ทั้งหมด / กำหนดเอง)
- metric ต่อ bucket: จำนวนรอบ, ชนะ, แพ้, win rate, ยอดเดิมพันรวม, payout รวม, P&L, ROI (= P&L / ยอดเดิมพันรวม), max drawdown ใน bucket, จำนวนครั้งที่ไล่ทุน, เวลาเล่นโดยประมาณ (รวมเฉพาะช่วงห่างระหว่างรอบที่ ≤ 15 นาที) และใน M3 เพิ่มยอดฝาก/ถอน
- UI:
  - การ์ดเทียบช่วงนี้กับช่วงก่อนหน้า (Δ ของ P&L, จำนวนรอบ, win rate)
  - กราฟแท่ง P&L ต่อ bucket ซ้อนกับเส้น P&L สะสม
  - **ปฏิทิน heatmap** รายเดือน ไล่สีเขียว/แดงตามขนาด P&L กดที่วันจะเปิด sheet รายการรอบของวันนั้น
  - ตารางสรุปที่ sort ได้ และ export เป็น CSV ได้
- ฟังก์ชันอยู่ใน `lib/calculations/periods.ts` (`bucketRounds(rounds, unit, tz)`, `summarizeBucket`)

### 6.3 Real P&L (M3)
กำไรจริง = ถอนรวม − ฝากรวม − ค่าธรรมเนียม + ยอดที่ยังอยู่บนแพลตฟอร์ม (ผู้ใช้กรอกเอง หรือใช้ current balance ของ session ที่เลือก) แปลงเป็นสกุลเดียวกันด้วยอัตราที่ผู้ใช้กรอก

## 7. Currency และค่าธรรมเนียม (M3)

- ผู้ใช้กรอกอัตรา USDT/THB และ USD/THB เอง ถ้าไม่กรอกจะซ่อนยอดที่แปลงเป็น THB
- `FeeSettings`: crypto withdrawal fee (จำนวนคงที่), exchange trading fee %, spread %, THB withdrawal fee (คงที่)
- สูตรยอดสุทธิที่ถอนเข้าธนาคาร:
  `((amount − cryptoFee) × rate × (1 − spread%) × (1 − tradeFee%)) − thbFee` ถ้าผลน้อยกว่า 0 ให้แสดง 0 พร้อมคำเตือน
- แสดงขั้นตอนการคำนวณทีละขั้นให้ตรวจสอบได้

## 8. หน้าแอปและ UX

**Routes:** `/` (Dashboard — ไม่ใช้ redirect เพราะ static export ไม่มี server redirect), `/calculator`, `/history`, `/analytics`, `/simulator`, `/wallet`, `/sessions`, `/settings`

**Navigation:**
- Desktop (≥ 1024px): sidebar ครบทุกหน้า
- Mobile: bottom nav 5 ช่อง คือ Dashboard, Calculator, History, Analytics และ More (sheet ที่รวม Simulator, Wallet, Sessions, Settings)

**Dashboard:** การ์ด balance, สถิติ session, กราฟย่อ, สถานะ Bankroll Guard, ปุ่ม Win/Lose ด่วน, P&L ของวันนี้และสัปดาห์นี้

**Calculator:**
- input: bet, multiplier (currency เป็นของ session — แก้ที่ Sessions; precision ตั้งที่ Settings)
- next round preview: กรณีชนะแสดง payout, กำไรสุทธิ, ยอดใหม่ / กรณีแพ้แสดงยอดที่เสีย, ยอดใหม่
- suggested bet, risk badge
- ปุ่ม WIN (สีเขียว, `CheckCircle`) และ LOSE (สีแดง, `XCircle`) ขนาดใหญ่
- ปุ่ม disabled เมื่อ input ไม่ถูกต้อง, เงินไม่พอ หรือติด hard cooldown
- กันกดซ้ำด้วย lock ใน store + disabled 300ms

**History:**
- ตาราง Round / Result / Bet / Multiplier / P&L / Balance / Time เรียงรอบล่าสุดก่อน
- search (note), filter (ผล, ช่วงเวลา), sort (เวลา, ผล, จำนวนเงิน)
- undo รอบล่าสุด, แก้ไข (dialog), ลบ (confirm), clear session (confirm โดยพิมพ์ชื่อ session)
- export CSV / JSON
- บน mobile แสดงเป็นรายการ card แทนตาราง

**Sessions:** สร้าง, เปลี่ยนชื่อ, สลับ, ลบ (confirm), ใส่ tag, ดูรายการ session เก่า, export/import backup ทั้งหมด (import มี preview และเลือกได้ว่าจะ merge หรือ replace)

**Wallet (M3):** CRUD ฝาก/ถอน และสรุป real P&L

**Settings:** precision, อัตราแลกเปลี่ยน, ค่าธรรมเนียม, Bankroll Guard, reality check, ข้อมูล (export/import/รีเซ็ต)

**Reality check (M3):** เริ่มจับเวลาเมื่อบันทึกรอบแรกของ session ในวันนั้น ทุก `intervalMin` นาทีจะขึ้น modal แสดงเวลาที่เล่นไปและ P&L ของ session มีปุ่ม "พัก" และ "เล่นต่อ"

**Keyboard shortcuts** (ปิดเมื่อ focus อยู่ใน input หรือ textarea):

| คีย์ | ทำอะไร |
|---|---|
| `W` | Win |
| `L` | Lose |
| `U` | Undo (มี toast ให้ redo) |
| `B` | ไปที่ช่อง bet |
| `M` | ไปที่ช่อง multiplier |
| `?` | ดูรายการคีย์ลัด |

**PWA (M3):** `app/manifest.ts` + `public/sw.js` เขียนเอง cache app shell แบบ stale-while-revalidate ติดตั้งลงหน้าจอได้และใช้ offline ได้

**ทั่วไป:**
- toast ด้วย sonner, confirm ด้วย AlertDialog
- empty state ทุกหน้า
- เข้าถึงได้ด้วย keyboard ทั้งหมด, focus ring ชัด, contrast ผ่าน WCAG AA

## 9. โครงสร้างโค้ด

```
app/
  layout.tsx, manifest.ts
  (app)/page.tsx (Dashboard), (app)/{calculator,history,analytics,simulator,wallet,sessions,settings}/page.tsx
components/
  layout/ (sidebar, bottom-nav, app-shell)   dashboard/   calculator/   history/
  charts/   analytics/   guard/   sessions/   wallet/   simulator/   ui/ (shadcn)
hooks/        useHydrated, useKeyboardShortcuts, useRealityCheck, useActiveSession, useTimeline
lib/
  calculations/ money, round, timeline, stats, periods, guard, risk, fx, montecarlo
  io/           csv, backup (zod schema + migrate)
  workers/      montecarlo.worker.ts
store/        bet-store, settings-store, wallet-store
types/        index.ts
tests/        mirror ของ lib/ และ store/
```

กฎ: `lib/` ห้าม import React หรือ store, component ห้ามคำนวณเงินเอง (ต้องเรียกผ่าน `lib/`) และ page component มีแค่การประกอบ component

## 10. Testing และคุณภาพ

Vitest unit tests:
- **calculations:** win, loss, ตัวอย่างใน spec (16.99 → 21.11 → 17.11), เปลี่ยน bet/multiplier แล้วรอบเก่าไม่เปลี่ยน, หลายรอบติดกัน, undo, แก้รอบเก่าแล้วรอบหลังคำนวณใหม่, ลบรอบกลาง, invalid input, เงินไม่พอ, flag `insufficient`, streak, max drawdown, ไม่มี float error (เช่น 0.1 + 0.2)
- **periods:** ขอบวันตามเวลาไทย (16:59Z กับ 17:01Z), สัปดาห์เริ่มวันจันทร์, ข้ามเดือนและข้ามปี, bucket ว่าง
- **guard:** suggested bet (ปัดลง, ขั้นต่ำ, ไม่เกินยอด), risk band, loss streak, chasing, stop-loss, take-profit, daily limit
- **risk / fx / fees:** break-even, EV, P(อย่างน้อย 1 รอบ), break-even rounds, การแปลงสกุลเงิน, สูตรค่าธรรมเนียม, ผลติดลบ
- **montecarlo:** seed เดิมได้ผลเดิม, p = 0 → หมดตัวแน่นอนเมื่อจำนวนรอบพอ, p = 1 → ไม่หมดตัว
- **io:** CSV escape, JSON export → import ได้ข้อมูลเหมือนเดิม, ไฟล์เสียแล้วข้อมูลเดิมไม่ถูกแตะ, migrate
- **store / persistence:** action ทุกตัว, กันกดซ้ำ, เขียนแล้วอ่านกลับจาก localStorage ได้ (jsdom), hard cooldown ยังอยู่หลัง rehydrate

เป้า coverage ของ `lib/` ≥ 90% (lines)

Scripts: `pnpm dev | build | typecheck | lint | test | test:coverage` ก่อนปิดแต่ละ milestone ต้องผ่านทั้งหมด และเช็ก responsive ที่ 375 / 768 / 1280 px

## 11. Repo, CI และ deploy

- GitHub public `rachata295-code/bettrack`, default branch `main`
- 1 milestone = 1 branch (`m1-mvp`, `m2-analytics`, `m3-extras`) + 1 PR
- GitHub Actions (`.github/workflows/ci.yml`): pnpm install → typecheck → lint → test → build บน push และ PR
- README: ภาพรวม, disclaimer, วิธีติดตั้ง, scripts, โครงสร้าง, ขั้นตอน deploy Vercel (import repo → framework Next.js → deploy) ผู้ใช้ต้องกด import เองเพราะใช้บัญชี Vercel ของผู้ใช้
- `LICENSE`: MIT

## 12. Milestones

**M1 — MVP**
- scaffold Next.js, Tailwind, shadcn, theme, app shell (sidebar + bottom nav)
- types, `lib/calculations/{money,round,timeline,stats}`, `lib/io`
- stores + persistence + hydration + หน้า recovery
- Calculator (preview, ปุ่ม Win/Lose, validation, กันกดซ้ำ), History ครบ, Sessions ครบ (รวม backup import/export), Dashboard พื้นฐาน (balance card + session stats), Settings (precision + data)
- คีย์ลัด W/L/U/B/M/?
- tests ส่วนที่เกี่ยวข้อง, CI, README

**M2 — Analytics และ Bankroll Guard**
- balance chart, Session tab, Period tab (bucket, compare, กราฟแท่ง, heatmap, ตาราง, CSV)
- Bankroll Guard ครบ §4
- risk tools §5 ยกเว้น Monte Carlo
- Dashboard แบบเต็ม (กราฟย่อ, สถานะ guard, P&L วันนี้/สัปดาห์นี้)

**M3 — ฟีเจอร์เสริม**
- Wallet และ real P&L, currency และค่าธรรมเนียม (§7)
- Monte Carlo simulator + worker
- PWA, reality check, tag filter ใน analytics

## 13. Definition of done (แต่ละ milestone)

- ฟีเจอร์ใน milestone ใช้งานได้จริงทุกปุ่ม ไม่มี placeholder
- typecheck, lint, test และ build ผ่านทั้งในเครื่องและ CI
- refresh browser แล้วข้อมูลยังอยู่
- ทดสอบด้วยตัวเองบน mobile width แล้ว
- reviewer ผ่าน (ตาม workflow planner → builder → reviewer → debugger)
