import { AccountingLedgerEntry } from './types';

/**
 * WHAT: Accumulates accounting entries for summary cards.
 * WHY: We need fast totals for Cash, UPI, and Credit without complex DB queries.
 * TIME COMPLEXITY: O(N) where N is number of entries today.
 */
export function calculateAccountingTotals(entries: AccountingLedgerEntry[]) {
  let cash = 0;
  let upi = 0;
  let credit = 0;

  for (const entry of entries) {
    if (entry.type === 'SALES_CASH') cash += entry.amountPaise;
    if (entry.type === 'REVERSAL_CASH') cash -= entry.amountPaise;
    
    if (entry.type === 'SALES_UPI') upi += entry.amountPaise;
    if (entry.type === 'REVERSAL_UPI') upi -= entry.amountPaise;
    
    if (entry.type === 'SALES_CREDIT') credit += entry.amountPaise;
    if (entry.type === 'REVERSAL_CREDIT') credit -= entry.amountPaise;
  }

  return { cash, upi, credit, total: cash + upi + credit };
}
