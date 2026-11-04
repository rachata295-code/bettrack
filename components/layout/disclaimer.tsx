export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={className ?? 'px-4 py-6 text-xs text-muted-foreground'}>
      Outcomes are uncertain. Past results do not predict future rounds. Figures here are your own records, not funds held on any
      platform. · ผลการเล่นไม่แน่นอน ผลในอดีตไม่ได้ทำนายรอบถัดไป
    </p>
  );
}
