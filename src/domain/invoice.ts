/**
 * WHAT: Generates an offline, unique, gap-free invoice number.
 * WHY: Required format VEH-YYYYMMDD-0001 per vehicle. Must work completely offline.
 * TIME COMPLEXITY: O(1)
 */
export function generateInvoiceNumber(vehicleId: string, date: string, counter: number): string {
  // Extract just the digits from YYYY-MM-DD
  const dateStr = date.replace(/-/g, '');
  const counterStr = counter.toString().padStart(4, '0');
  
  // Example: v1 -> V1
  const shortVeh = vehicleId.toUpperCase();
  
  return `${shortVeh}-${dateStr}-${counterStr}`;
}
