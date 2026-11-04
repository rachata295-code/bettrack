import { Card, CardContent } from '@/components/ui/card';
import { D, formatMoney } from '@/lib/calculations/money';
import type { previewRound } from '@/lib/calculations/round';

type Preview = ReturnType<typeof previewRound>;

function Row({ label, value, tone }: { label: string; value: string; tone?: 'profit' | 'loss' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`num font-medium ${tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/** preview is null when the input is invalid; every figure then shows an em dash. */
export function RoundPreview({ preview, precision }: { preview: Preview | null; precision: number }) {
  const m = (v: string, signed = false) => formatMoney(v, { precision, signed });
  const dash = '—';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="bg-surface">
        <CardContent className="space-y-2">
          <h2 className="font-semibold text-profit">If Win</h2>
          <dl className="space-y-1.5">
            <Row label="Payout" value={preview ? m(preview.win.payout) : dash} />
            <Row label="Net profit" value={preview ? m(preview.win.profit, true) : dash} tone="profit" />
            <Row label="New balance" value={preview ? m(preview.win.newBalance) : dash} />
          </dl>
        </CardContent>
      </Card>
      <Card className="bg-surface">
        <CardContent className="space-y-2">
          <h2 className="font-semibold text-loss">If Lose</h2>
          <dl className="space-y-1.5">
            <Row label="Amount lost" value={preview ? m(D(preview.lose.loss).neg().toString(), true) : dash} tone="loss" />
            <Row label="New balance" value={preview ? m(preview.lose.newBalance) : dash} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
