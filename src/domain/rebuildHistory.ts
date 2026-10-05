import { getDB } from '../data/db';
import { Invoice } from './types';

/**
 * Rebuilds the totals in all DaySummary (WorkDay) records using the invoices as the absolute source of truth.
 * This is idempotent and will not alter invoices or ledgers.
 * 
 * - Recalculates total sales, cash, UPI, credit, number of bills, items sold.
 */
export async function rebuildHistory() {
  const db = await getDB();
  const allDays = await db.getAll('workDays');
  const allInvoices = await db.getAll('invoices');

  // Create an index of invoices by workDayId
  const invoicesByDay = new Map<string, Invoice[]>();
  for (const inv of allInvoices) {
    if (inv.status === 'VALID') {
      const arr = invoicesByDay.get(inv.workDayId) || [];
      arr.push(inv);
      invoicesByDay.set(inv.workDayId, arr);
    }
  }

  const tx = db.transaction('workDays', 'readwrite');
  const store = tx.objectStore('workDays');

  for (const day of allDays) {
    if (day.state !== 'CLOSED') continue; // Only rebuild closed days

    const dayInvoices = invoicesByDay.get(day.workDayId) || [];
    
    let totalSalesPaise = 0;
    let cashSalesPaise = 0;
    let upiSalesPaise = 0;
    let creditSalesPaise = 0;
    let numberOfBills = dayInvoices.length;
    let itemsSold = 0;

    for (const inv of dayInvoices) {
      totalSalesPaise += inv.totalAmountPaise;
      if (inv.paymentMode === 'CASH') cashSalesPaise += inv.totalAmountPaise;
      else if (inv.paymentMode === 'UPI') upiSalesPaise += inv.totalAmountPaise;
      else if (inv.paymentMode === 'CREDIT') creditSalesPaise += inv.totalAmountPaise;

      for (const item of inv.items) {
        itemsSold += item.quantityPieces;
      }
    }

    let needsUpdate = false;
    if (
      day.totalSalesPaise !== totalSalesPaise ||
      day.cashSalesPaise !== cashSalesPaise ||
      day.upiSalesPaise !== upiSalesPaise ||
      day.creditSalesPaise !== creditSalesPaise ||
      day.numberOfBills !== numberOfBills ||
      day.itemsSold !== itemsSold
    ) {
      day.totalSalesPaise = totalSalesPaise;
      day.cashSalesPaise = cashSalesPaise;
      day.upiSalesPaise = upiSalesPaise;
      day.creditSalesPaise = creditSalesPaise;
      day.numberOfBills = numberOfBills;
      day.itemsSold = itemsSold;
      needsUpdate = true;
    }

    if (!day.dayStockReportSnapshot || !(Object.values(day.dayStockReportSnapshot)[0] as any)?.priceSnapshotPaise) {
      const { getDayStockReport } = await import('./dayStockReport');
      const report = await getDayStockReport(day.workDayId);
      const snapObj: Record<string, any> = {};
      for (const row of report) { snapObj[row.productId] = row; }
      day.dayStockReportSnapshot = snapObj as any;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await store.put(day);
    }
  }
  
  await tx.done;
}
