import { StockLedgerEntry } from './types';

/**
 * WHAT: Calculates the remaining stock for a single product at a specific location.
 * WHY: Both warehouse and vehicle stock are calculated from the same ledger table by filtering on locationId.
 * TIME COMPLEXITY: O(N) where N is ledger entries.
 */
export function calculateRemainingStock(entries: StockLedgerEntry[], productId: string, locationId: string): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.productId === productId && entry.locationId === locationId && entry.type !== 'HOLD_CARRY_FORWARD') {
      total += entry.quantityPieces;
    }
  }
  return total;
}

/**
 * WHAT: Generates a stock summary for a vehicle for the current workday.
 * WHY: "Loaded" and "Sold" must only count the CURRENT work day to avoid leaking yesterday's stats.
 * "Remaining" is calculated safely from opening stock + today's loads - today's sales.
 * TIME COMPLEXITY: O(N)
 */
export function calculateVehicleStockSummary(
  entries: StockLedgerEntry[], 
  vehicleId: string, 
  workDayId: string,
  openingStockSnapshot: Record<string, number>
) {
  const summary = new Map<string, { loaded: number; sold: number; remaining: number }>();

  // Prepopulate opening stock
  for (const [productId, quantity] of Object.entries(openingStockSnapshot)) {
    summary.set(productId, { loaded: 0, sold: 0, remaining: quantity });
  }

  for (const entry of entries) {
    if (entry.locationId !== vehicleId) continue;
    if (entry.workDayId !== workDayId) continue; // Only process today's events!

    if (!summary.has(entry.productId)) {
      summary.set(entry.productId, { loaded: 0, sold: 0, remaining: 0 });
    }
    const stats = summary.get(entry.productId)!;
    
    // Vehicle receives stock on LOAD_IN
    if (entry.type === 'LOAD_IN') {
      stats.loaded += entry.quantityPieces;
      stats.remaining += entry.quantityPieces;
    } 
    // Sales have negative quantity in ledger
    else if (entry.type === 'SALE') {
      stats.sold += Math.abs(entry.quantityPieces);
      stats.remaining += entry.quantityPieces;
    } 
    // Cancelled sales have positive quantity
    else if (entry.type === 'SALE_CANCEL') {
      stats.sold -= entry.quantityPieces;
      stats.remaining += entry.quantityPieces;
    }
    // Unload out removes stock
    else if (entry.type === 'UNLOAD_OUT') {
      stats.remaining += entry.quantityPieces; // quantity is negative
    }
  }
  return summary;
}

export function canFulfillStock(entries: StockLedgerEntry[], productId: string, locationId: string, requestedPieces: number): boolean {
  const remaining = calculateRemainingStock(entries, productId, locationId);
  return remaining >= requestedPieces;
}

/**
 * WHAT: Calculates the median of an array of numbers.
 * WHY: We use median instead of average to ignore outlier massive loads.
 */
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

export interface TopUpSuggestion {
  productId: string;
  currentBalance: number;
  usualLevel: number;
  suggestedTopUp: number;
  ratio: number;
}

/**
 * WHAT: Suggests products to top-up if current balance < 25% of median 7-day starting stock.
 * WHY: Helps salesman know what they are low on without guessing.
 * TIME COMPLEXITY: O(P log P) due to sorting, where P is number of products. P is small, so no heap needed.
 */
export function getLowStockSuggestions(
  stockSummary: Map<string, { remaining: number }>,
  historicalLevels: Record<string, number[]>,
  products: { id: string; piecesPerBox: number }[],
  warehouseRemaining: (productId: string) => number
): TopUpSuggestion[] {
  const suggestions: TopUpSuggestion[] = [];
  
  for (const product of products) {
    const remaining = stockSummary.get(product.id)?.remaining || 0;
    const history = historicalLevels[product.id] || [];
    
    // Usual is median of 7 days, or fallback to 10 boxes if no history
    const usualLevel = history.length > 0 ? getMedian(history) : product.piecesPerBox * 10;
    
    // Threshold is 25%
    if (remaining < usualLevel * 0.25) {
      const warehouseAvail = warehouseRemaining(product.id);
      const diff = usualLevel - remaining;
      const suggestedTopUp = Math.min(diff, warehouseAvail);
      
      if (suggestedTopUp > 0) {
        suggestions.push({
          productId: product.id,
          currentBalance: remaining,
          usualLevel,
          suggestedTopUp,
          ratio: remaining / usualLevel
        });
      }
    }
  }
  
  // Sort by ratio ascending (most critical first)
  return suggestions.sort((a, b) => a.ratio - b.ratio);
}
