import { getDayStockReport } from './dayStockReport';
import { DayStockReportRow } from './types';

// O(n + p) - we already built this logic in getDayStockReport using Maps. 
// We just wrap it here as requested.
export async function buildDayStockTable(workDayId: string): Promise<DayStockReportRow[]> {
  return await getDayStockReport(workDayId);
}

export function calculateDifference(expected: number, counted: number): number {
  return counted - expected;
}

export function checkSoldValueAgainstSales(stockSalesPaise: number, invoiceSalesPaise: number): number {
  return Math.abs(stockSalesPaise - invoiceSalesPaise);
}

export function convertToTotalPieces(qty: number): number {
  // It's already in pieces, so this is just an identity function for the requested name
  return qty;
}
