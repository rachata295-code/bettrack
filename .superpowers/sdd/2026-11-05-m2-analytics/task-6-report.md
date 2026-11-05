# Task 6 report
- RED: tests/lib/series.test.ts failed ("Failed to resolve import @/lib/calculations/series"). GREEN: 5/5 after adding lib/calculations/series.ts.
- balanceSeries(initial, timeline, precision) adds balanceText/pnlText (pnl signed, U+2212). bucketSeries accumulates with Decimal (0.1+0.2 = 0.3 tested).
- components/charts/balance-chart.tsx: 'use client', figure aria-label summary, CSS-variable colors, reduced-motion guard, dots off above 500 points, custom tooltip using precomputed text only.
- Verification: typecheck, lint clean; vitest 24 files / 269 tests pass; pnpm build OK.
- Caveat: no page imports the chart yet, so build does not exercise it; not visually verified (Task 7).
- recharts 3.10.1 added.
