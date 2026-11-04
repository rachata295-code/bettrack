import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RoundResult } from '@/types';

export function ResultBadge({ result }: { result: RoundResult }) {
  return (
    <Badge variant="outline" className={cn(result === 'win' ? 'border-profit/40 bg-profit/15 text-profit' : 'border-loss/40 bg-loss/15 text-loss')}>
      {result === 'win' ? 'WIN' : 'LOSE'}
    </Badge>
  );
}

export const INSUFFICIENT_TEXT = 'Bet exceeded balance at this point';
