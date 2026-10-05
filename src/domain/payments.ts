import { Customer, PaymentMode } from './types';

/**
 * WHAT: Validates payment selection.
 * WHY: Walk-in customers cannot have credit. Credit must be within limit.
 * TIME COMPLEXITY: O(1)
 */
export function validatePaymentMode(
  mode: PaymentMode, 
  amountPaise: number, 
  customer?: Customer
): string | null {
  if (mode === 'CREDIT') {
    if (!customer) return 'Credit is not allowed for walk-in customers.';
    if (customer.creditLimitPaise !== undefined && 
        (customer.outstandingBalancePaise + amountPaise) > customer.creditLimitPaise) {
      return `Credit limit exceeded. Limit: ${(customer.creditLimitPaise / 100).toFixed(2)}, Current Balance: ${(customer.outstandingBalancePaise / 100).toFixed(2)}, This Bill: ${(amountPaise / 100).toFixed(2)}`;
    }
  }
  return null;
}
