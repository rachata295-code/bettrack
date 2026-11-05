'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { RealPnlCard } from '@/components/wallet/real-pnl-card';
import { TransactionDialog } from '@/components/wallet/transaction-dialog';
import { TransactionList } from '@/components/wallet/transaction-list';
import { WithdrawalCalculator } from '@/components/wallet/withdrawal-calculator';
import { Button } from '@/components/ui/button';

export default function WalletPage() {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <Button onClick={() => setAdding(true)}><Plus /> Add transaction</Button>
      </div>
      <RealPnlCard />
      <h2 className="text-base font-medium">Transactions</h2>
      <TransactionList />
      <WithdrawalCalculator />
      <TransactionDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
