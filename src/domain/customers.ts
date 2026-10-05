import { Customer } from './types';

/**
 * WHAT: Validates if a new customer can be created.
 * WHY: We need 10 digit unique mobile numbers and a name.
 * TIME COMPLEXITY: O(1) for validation.
 */
export function validateNewCustomer(customer: Partial<Customer>): string | null {
  if (!customer.name || customer.name.trim().length === 0) return 'Name is required';
  if (!customer.mobile || !/^\d{10}$/.test(customer.mobile)) return 'Mobile must be 10 digits';
  return null;
}

/**
 * WHAT: Generates an LRU list of recent customers based on lastSoldTimestamp.
 * WHY: Quick access to recent buyers for fast re-ordering.
 * TIME COMPLEXITY: O(N log N) where N is all customers.
 */
export function getRecentCustomers(customers: Customer[], limit = 10): Customer[] {
  return [...customers]
    .filter(c => c.lastSoldTimestamp)
    .sort((a, b) => (b.lastSoldTimestamp || 0) - (a.lastSoldTimestamp || 0))
    .slice(0, limit);
}

/**
 * WHAT: Checks if a customer can take on additional credit.
 * WHY: Enforces credit limits to prevent bad debt.
 * TIME COMPLEXITY: O(1)
 */
export function canTakeCredit(customer: Customer, newAmountPaise: number): boolean {
  if (customer.creditLimitPaise === undefined) return true; // No limit
  return (customer.outstandingBalancePaise + newAmountPaise) <= customer.creditLimitPaise;
}
