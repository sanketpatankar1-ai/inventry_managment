import { getDB } from './db';
import { Invoice, WorkDay } from '../domain/types';

export async function queryInvoicesByDateRange(startDateStr: string, endDateStr: string): Promise<Invoice[]> {
  const db = await getDB();
  const tx = db.transaction('invoices', 'readonly');
  const index = tx.store.index('by-calendarDate');
  
  // IDBKeyRange bounds (inclusive)
  const range = IDBKeyRange.bound(startDateStr, endDateStr);
  const invoices = await index.getAll(range);
  
  return invoices;
}

export async function queryWorkDaysByDateRange(startDateStr: string, endDateStr: string): Promise<WorkDay[]> {
  const db = await getDB();
  // We didn't add a calendarDate index to workDays, so we just filter in memory for now,
  // or we can add it, but it's a small store (1 per day)
  const allDays = await db.getAll('workDays');
  return allDays.filter(d => d.calendarDate >= startDateStr && d.calendarDate <= endDateStr);
}
