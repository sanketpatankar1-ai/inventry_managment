import { getDB } from '../data/db';
import { productMap } from '../data/seedData';
import { DayStockReportRow } from './types';

export async function getDayStockReport(workDayId: string): Promise<DayStockReportRow[]> {
  const db = await getDB();
  const workDay = await db.get('workDays', workDayId);
  if (!workDay) throw new Error('WorkDay not found');

  // Closed days read the frozen numbers from the DaySummary snapshot
  if (workDay.state === 'CLOSED' && workDay.dayStockReportSnapshot) {
    return Object.values(workDay.dayStockReportSnapshot);
  }

  // Build the report in ONE pass over that work day's ledger entries (O(L)) into a Map
  const tx = db.transaction(['ledger', 'loads', 'invoices'], 'readonly');
  
  // Get all ledger entries for this workday using the index
  const ledgerIndex = tx.objectStore('ledger').index('by-workDayId');
  const ledgerEntries = await ledgerIndex.getAll(workDayId);
  
  // Get all loads for this workday to figure out phase if necessary
  const loads = await tx.objectStore('loads').getAll();
  const todayLoads = loads.filter(l => l.workDayId === workDayId);
  const loadPhaseMap = new Map<string, 'START'|'TOPUP'>();
  for (const l of todayLoads) {
    loadPhaseMap.set(l.id, l.phase || 'START');
  }

  // Get invoices for sales amount
  const invoices = await tx.objectStore('invoices').index('by-workDayId').getAll(workDayId);
  const salesMap = new Map<string, { paise: number; cancelledCount: number }>();
  
  for (const inv of invoices) {
    for (const item of inv.items) {
      const data = salesMap.get(item.productId) || { paise: 0, cancelledCount: 0 };
      if (inv.status === 'VALID') {
        data.paise += item.lineTotalPaise;
      } else {
        data.cancelledCount++;
      }
      salesMap.set(item.productId, data);
    }
  }

  const reportMap = new Map<string, DayStockReportRow>();

  const getRow = (productId: string): DayStockReportRow => {
    if (!reportMap.has(productId)) {
      reportMap.set(productId, {
        productId,
        productName: productMap.get(productId)?.name || productId,
        opening: 0,
        loadedAtStart: 0,
        topUp: 0,
        totalAvailable: 0,
        sold: 0,
        expectedRemaining: 0,
        countedRemaining: 0,
        difference: 0,
        salesRs: 0,
        salesPaise: 0,
        cancelledBillsCount: 0,
        holdQty: 0,
        unloadQty: 0,
        timeline: [],
        startFromHeldPieces: 0,
        startLoadedPieces: 0,
        soldPieces: 0,
        soldAmountPaise: 0,
        remainingToGodownPieces: 0,
        remainingHeldInVehiclePieces: 0,
        priceSnapshotPaise: workDay.pricesSnapshot?.[productId] || productMap.get(productId)?.pricePaise || 0
      });
    }
    return reportMap.get(productId)!;
  };

  // Pre-seed all products
  for (const pid of productMap.keys()) {
    getRow(pid);
  }

  // DSA // ONE pass over ledger entries PERFORMANCE: Build all rows in ONE pass over the day's ledger entries and invoice lines, using Map<productId, RowTotals>. This is O(n + p). Do not loop the whole ledger once per product. No heavy algorithm is needed because the product list is small, and one pass with a Map is the simplest correct choice.
  for (const entry of ledgerEntries) {
    if (entry.locationId !== workDay.vehicleId) continue;
    
    const row = getRow(entry.productId);
    const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Opening stock (carried forward)
    if (entry.type === 'HOLD_CARRY_FORWARD') {
      row.opening += entry.quantityPieces;
      row.timeline.push({ time: timeStr, desc: 'Opening', qtyPieces: entry.quantityPieces, _ts: entry.timestamp } as any);
    } 
    // Loads
    else if (entry.type === 'LOAD_IN') {
      const phase = loadPhaseMap.get(entry.referenceId!) || 'START';
      if (phase === 'START') {
        row.loadedAtStart += entry.quantityPieces;
        row.timeline.push({ time: timeStr, desc: 'Loaded', qtyPieces: entry.quantityPieces, _ts: entry.timestamp } as any);
      } else {
        row.topUp += entry.quantityPieces;
        row.timeline.push({ time: timeStr, desc: 'Top-up', qtyPieces: entry.quantityPieces, _ts: entry.timestamp } as any);
      }
    }
    // Sales (including CANCEL)
    else if (entry.type === 'SALE') {
      row.sold -= entry.quantityPieces; // Note: SALE usually has negative quantity on vehicle
    }
    else if (entry.type === 'SALE_CANCEL') {
      row.sold -= entry.quantityPieces; // quantity is positive (returns to vehicle)
    }
    // Unloads & Holds (counted at end of day)
    else if (entry.type === 'UNLOAD_OUT') {
      row.unloadQty += Math.abs(entry.quantityPieces);
    }
    // Hold stock recorded at unload time
    // wait, hold is not a ledger entry. It's stored in workDay.heldItems
  }

  // Process counted and expected
  for (const [productId, row] of reportMap.entries()) {
    row.totalAvailable = row.opening + row.loadedAtStart + row.topUp;
    row.expectedRemaining = row.totalAvailable - row.sold;
    
    // Counted remaining comes from unload process
    row.holdQty = workDay.heldItems?.[productId] || 0;
    
    // Wait, unloadQty from ledger UNLOAD_OUT is recorded when approved.
    // If pending approval, we must use workDay.unloadedItems
    if (workDay.state === 'UNLOAD_REQUESTED' || workDay.state === 'APPROVED' || workDay.state === 'CLOSED') {
      row.unloadQty = workDay.unloadedItems?.[productId] || 0;
      row.countedRemaining = row.holdQty + row.unloadQty;
    }

    row.difference = row.countedRemaining - row.expectedRemaining;
    
    const s = salesMap.get(productId);
    if (s) {
      row.salesPaise = s.paise;
      row.salesRs = s.paise / 100;
      row.cancelledBillsCount = s.cancelledCount;
      row.soldAmountPaise = s.paise;
    }
    
    row.startFromHeldPieces = row.opening;
    row.startLoadedPieces = row.loadedAtStart + row.topUp;
    row.soldPieces = row.sold;
    row.remainingToGodownPieces = row.unloadQty;
    row.remainingHeldInVehiclePieces = row.holdQty;

    // Development assertion
    if (row.totalAvailable - row.sold !== row.expectedRemaining) {
      console.warn(`Mismatch in expected formula for ${productId}`);
    }
  }

  // Sort timeline by timestamp
  for (const row of reportMap.values()) {
    row.timeline.sort((a: any, b: any) => a._ts - b._ts);
  }

  // Add any items in workDay.heldItems or unloadedItems that didn't have ledger entries yet
  if (workDay.heldItems) {
    for (const [productId, qty] of Object.entries(workDay.heldItems) as [string, number][]) {
      if (qty > 0) {
        const row = getRow(productId);
        row.holdQty = qty;
        row.countedRemaining = row.holdQty + row.unloadQty;
        row.difference = row.countedRemaining - row.expectedRemaining;
        row.remainingHeldInVehiclePieces = qty;
      }
    }
  }
  if (workDay.unloadedItems) {
    for (const [productId, qty] of Object.entries(workDay.unloadedItems) as [string, number][]) {
      if (qty > 0) {
        const row = getRow(productId);
        row.unloadQty = qty;
        row.countedRemaining = row.holdQty + row.unloadQty;
        row.difference = row.countedRemaining - row.expectedRemaining;
        row.remainingToGodownPieces = qty;
      }
    }
  }

  // Sort by product name
  const result = Array.from(reportMap.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  
  return result;
}
