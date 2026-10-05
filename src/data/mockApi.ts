import { apiSubmitUnloadRequest } from './apiClient';
import { getDB } from './db';
import { SEED_OUTLETS_MONDAY, SEED_PRODUCTS, VEHICLE_DEWAS, WAREHOUSE_DEWAS, SALESMAN_DEWAS, WAREHOUSE_HARDPIPLYA, SEED_CUSTOMERS } from './seedData';
import { StockLedgerEntry, DayState, WorkDay, Invoice, Outlet, LoadEvent, Customer, AccountingLedgerEntry } from '../domain/types';
import { generateInvoiceNumber } from '../domain/invoice';

import { rebuildHistory } from '../domain/rebuildHistory';

let historyRebuilt = false;

let activeDayCreationPromise: Promise<WorkDay> | null = null;

export async function fetchActiveWorkDay(): Promise<WorkDay> {
  if (!historyRebuilt) {
    historyRebuilt = true;
    await rebuildHistory();
  }

  const db = await getDB();
  const allDays = await db.getAll('workDays');
  
  // Find the latest day for this salesman/vehicle
  const sortedDays = allDays
    .filter(d => d.salesmanId === SALESMAN_DEWAS && d.vehicleId === VEHICLE_DEWAS)
    .sort((a, b) => b.openedAt - a.openedAt);
    
  let activeDay = sortedDays[0];

  // If no day exists or the latest day is CLOSED, create a new NOT_STARTED day immediately.
  if (!activeDay || activeDay.state === 'CLOSED') {
    if (!activeDayCreationPromise) {
      activeDayCreationPromise = startNewWorkDay().finally(() => {
        activeDayCreationPromise = null;
      });
    }
    activeDay = await activeDayCreationPromise;
  }
  
  return activeDay;
}

export async function startNewWorkDay(): Promise<WorkDay> {
  const db = await getDB();
  const workDayId = `wd-${Date.now()}`;
  const calendarDate = new Date().toISOString().split('T')[0];
  
  // Compute absolute vehicle stock for opening snapshot (which is exactly what was held from yesterday)
  const ledgers = await db.getAll('ledger');
  const openingStockSnapshot: Record<string, number> = {};
  for (const entry of ledgers) {
    if (entry.locationId === VEHICLE_DEWAS && entry.type !== 'HOLD_CARRY_FORWARD') {
      openingStockSnapshot[entry.productId] = (openingStockSnapshot[entry.productId] || 0) + entry.quantityPieces;
    }
  }

  // Get previous closed day to inherit history
  const allDays = await db.getAll('workDays');
  const sortedDays = allDays
    .filter(d => d.salesmanId === SALESMAN_DEWAS && d.vehicleId === VEHICLE_DEWAS && d.state === 'CLOSED')
    .sort((a, b) => b.openedAt - a.openedAt);
  const lastClosedDay = sortedDays[0];

  const heldDays: Record<string, number> = {};
  const historicalStockLevels = lastClosedDay?.historicalStockLevels || {};

  for (const p of SEED_PRODUCTS) {
    const qty = openingStockSnapshot[p.id] || 0;
    if (qty > 0) {
      heldDays[p.id] = (lastClosedDay?.heldDays?.[p.id] || 0) + 1;
    } else {
      heldDays[p.id] = 0;
    }
  }

  // Build price snapshot
  const pricesSnapshot: Record<string, number> = {};
  for (const product of SEED_PRODUCTS) {
    pricesSnapshot[product.id] = product.pricePaise;
  }

  const newDay: WorkDay = {
    workDayId,
    calendarDate,
    state: 'NOT_STARTED',
    salesmanId: SALESMAN_DEWAS,
    vehicleId: VEHICLE_DEWAS,
    warehouseId: WAREHOUSE_DEWAS,
    routeId: 'r1',
    openedAt: Date.now(),
    openingStockSnapshot,
    heldDays,
    historicalStockLevels,
    cashCollectedPaise: 0,
    invoiceCounter: 0,
    totalSalesPaise: 0,
    cashSalesPaise: 0,
    upiSalesPaise: 0,
    creditSalesPaise: 0,
    numberOfBills: 0,
    itemsSold: 0,
    pricesSnapshot,
  };
  await db.put('workDays', newDay);
  return newDay;
}

export async function seedInitialData() {
  const db = await getDB();
  
  // Seed Warehouse Stock
  const ledgers = await db.getAll('ledger');
  const hasWarehouseStock = ledgers.some(l => l.locationId === WAREHOUSE_DEWAS);
  if (!hasWarehouseStock) {
    const tx = db.transaction('ledger', 'readwrite');
    for (const product of SEED_PRODUCTS) {
      tx.store.put({
        id: `seed-wh-dewas-${product.id}`, timestamp: Date.now(), type: 'LOAD_IN',
        productId: product.id, quantityPieces: 10000 * product.piecesPerBox, locationId: WAREHOUSE_DEWAS,
      });
      tx.store.put({
        id: `seed-wh-hardpiplya-${product.id}`, timestamp: Date.now(), type: 'LOAD_IN',
        productId: product.id, quantityPieces: 10000 * product.piecesPerBox, locationId: WAREHOUSE_HARDPIPLYA,
      });
    }
    await tx.done;
  }

  // Seed Outlets
  const outlets = await db.getAll('outlets');
  if (outlets.length === 0) {
    for (const o of SEED_OUTLETS_MONDAY) {
      await db.put('outlets', { ...o, status: 'Pending' });
    }
  }

  // Seed Customers
  const customers = await db.getAll('customers');
  if (customers.length === 0) {
    const tx = db.transaction('customers', 'readwrite');
    for (const c of SEED_CUSTOMERS) {
      tx.store.put(c);
    }
    await tx.done;
  }
}

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDB();
  return db.getAll('customers');
}

export async function addCustomer(customer: Customer) {
  const db = await getDB();
  await db.put('customers', customer);
}

export async function updateDayState(workDayId: string, newState: DayState) {
  const db = await getDB();
  const summary = await db.get('workDays', workDayId);
  if (summary) {
    summary.state = newState;
    if (newState === 'ON_ROUTE' && !summary.routeStartedAt) {
      summary.routeStartedAt = Date.now();
    }
    await db.put('workDays', summary);
  }
}

// devResetDay now simply creates a NEW workday!
export async function devResetDay() {
  await startNewWorkDay();
}

export async function submitLoadStock(workDayId: string, warehouseId: string, vehicleId: string, items: {productId: string, quantityPieces: number}[]) {
  const db = await getDB();
  const tx = db.transaction(['ledger', 'loads', 'workDays'], 'readwrite');
  
  const summary = await tx.objectStore('workDays').get(workDayId);
  const phase = (summary && (summary.routeStartedAt || summary.state === 'ON_ROUTE')) ? 'TOPUP' : 'START';

  const loadId = `load-${Date.now()}`;
  const loadEvent: LoadEvent = {
    id: loadId, timestamp: Date.now(), vehicleId, warehouseId, workDayId, items, phase
  };
  tx.objectStore('loads').put(loadEvent);

  for (const item of items) {
    if (item.quantityPieces <= 0) continue;
    tx.objectStore('ledger').put({
      id: `${loadId}-out-${item.productId}`, referenceId: loadId, timestamp: Date.now(),
      type: 'LOAD_OUT', productId: item.productId, quantityPieces: -item.quantityPieces, locationId: warehouseId
    });
    tx.objectStore('ledger').put({
      id: `${loadId}-in-${item.productId}`, referenceId: loadId, timestamp: Date.now(), workDayId,
      type: 'LOAD_IN', productId: item.productId, quantityPieces: item.quantityPieces, locationId: vehicleId
    });
  }
  await tx.done;
}

export async function getLedger(): Promise<StockLedgerEntry[]> {
  const db = await getDB();
  return db.getAll('ledger');
}

export async function getLoads(): Promise<LoadEvent[]> {
  const db = await getDB();
  return db.getAll('loads');
}

export async function saveSaleGenerateInvoice(workDayId: string, saleData: Omit<Invoice, 'id'|'invoiceNumber'|'status'|'createdAt'|'calendarDate'|'previousBalancePaise'|'newBalancePaise'|'workDayId'|'customerName'>): Promise<string> {
  const db = await getDB();
  const tx = db.transaction(['invoices', 'ledger', 'workDays', 'outlets', 'customers', 'accounting'], 'readwrite');
  
  const summary = await tx.objectStore('workDays').get(workDayId);
  if (!summary) throw new Error('No day summary');
  
  summary.invoiceCounter += 1;
  const invoiceId = `inv-${Date.now()}`;
  const invoiceNum = generateInvoiceNumber(saleData.vehicleId, summary.calendarDate, summary.invoiceCounter);
  
  let customerName = 'Walk-in';
  if (saleData.customerId && saleData.customerId !== 'walk-in') {
    const cust = await tx.objectStore('customers').get(saleData.customerId);
    if (cust) customerName = cust.name;
  }

  const invoice: Invoice = {
    ...saleData,
    id: invoiceId,
    invoiceNumber: invoiceNum,
    createdAt: Date.now(),
    calendarDate: summary.calendarDate,
    customerName,
    workDayId,
    status: 'VALID'
  };

  // 1. Accounting entries & Customer balance updates
  if (saleData.paymentMode === 'CASH') {
    summary.cashSalesPaise += saleData.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `acc-cash-${invoiceId}`, timestamp: Date.now(), type: 'SALES_CASH', amountPaise: saleData.totalAmountPaise, invoiceId, workDayId });
  } else if (saleData.paymentMode === 'UPI') {
    summary.upiSalesPaise += saleData.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `acc-upi-${invoiceId}`, timestamp: Date.now(), type: 'SALES_UPI', amountPaise: saleData.totalAmountPaise, invoiceId, workDayId });
  } else if (saleData.paymentMode === 'CREDIT' && saleData.customerId) {
    summary.creditSalesPaise += saleData.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `acc-credit-${invoiceId}`, timestamp: Date.now(), type: 'SALES_CREDIT', amountPaise: saleData.totalAmountPaise, invoiceId, customerId: saleData.customerId, workDayId });
    tx.objectStore('accounting').put({ id: `acc-recv-${invoiceId}`, timestamp: Date.now(), type: 'CUSTOMER_RECEIVABLE', amountPaise: saleData.totalAmountPaise, invoiceId, customerId: saleData.customerId, workDayId });
    
    // Update Customer
    const customer = await tx.objectStore('customers').get(saleData.customerId);
    if (customer) {
      invoice.previousBalancePaise = customer.outstandingBalancePaise;
      customer.outstandingBalancePaise += saleData.totalAmountPaise;
      invoice.newBalancePaise = customer.outstandingBalancePaise;
      tx.objectStore('customers').put(customer);
    }
  }

  if (saleData.customerId && saleData.customerId !== 'walk-in') {
    const customer = await tx.objectStore('customers').get(saleData.customerId);
    if (customer) {
      customer.lastSoldTimestamp = Date.now();
      tx.objectStore('customers').put(customer);
    }
  }

  // 2. Day Summary updates
  summary.totalSalesPaise += saleData.totalAmountPaise;
  summary.numberOfBills += 1;
  const itemsCount = saleData.items.reduce((sum, item) => sum + item.quantityPieces, 0);
  summary.itemsSold += itemsCount;
  await tx.objectStore('workDays').put(summary);

  // 3. Invoice creation
  await tx.objectStore('invoices').put(invoice);
  
  // 4. Ledger deduction
  for (const item of saleData.items) {
    await tx.objectStore('ledger').put({
      id: `${invoiceId}-sale-${item.productId}`, referenceId: invoiceId, timestamp: Date.now(), workDayId,
      type: 'SALE', productId: item.productId, quantityPieces: -item.quantityPieces, locationId: saleData.vehicleId,
    });
  }

  if (saleData.outletId) {
    const outlet = await tx.objectStore('outlets').get(saleData.outletId);
    if (outlet) {
      outlet.status = 'Visited';
      await tx.objectStore('outlets').put(outlet);
    }
  }

  await tx.done;
  return invoiceId;
}

export async function cancelInvoice(invoiceId: string) {
  const db = await getDB();
  const tx = db.transaction(['invoices', 'ledger', 'workDays', 'customers', 'accounting'], 'readwrite');
  
  const invoice = await tx.objectStore('invoices').get(invoiceId);
  if (!invoice || invoice.status === 'VOID') return;

  const summary = await tx.objectStore('workDays').get(invoice.workDayId);
  
  invoice.status = 'VOID';
  await tx.objectStore('invoices').put(invoice);

  // 1. Return stock
  for (const item of invoice.items) {
    await tx.objectStore('ledger').put({
      id: `cancel-${invoiceId}-${item.productId}`, referenceId: invoiceId, timestamp: Date.now(), workDayId: invoice.workDayId,
      type: 'SALE_CANCEL', productId: item.productId, quantityPieces: item.quantityPieces, locationId: invoice.vehicleId,
    });
  }

  // 2. Reverse accounting & customer balance
  if (invoice.paymentMode === 'CASH') {
    if (summary) summary.cashSalesPaise -= invoice.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `rev-cash-${invoiceId}`, timestamp: Date.now(), type: 'REVERSAL_CASH', amountPaise: invoice.totalAmountPaise, invoiceId, workDayId: invoice.workDayId });
  } else if (invoice.paymentMode === 'UPI') {
    if (summary) summary.upiSalesPaise -= invoice.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `rev-upi-${invoiceId}`, timestamp: Date.now(), type: 'REVERSAL_UPI', amountPaise: invoice.totalAmountPaise, invoiceId, workDayId: invoice.workDayId });
  } else if (invoice.paymentMode === 'CREDIT' && invoice.customerId) {
    if (summary) summary.creditSalesPaise -= invoice.totalAmountPaise;
    tx.objectStore('accounting').put({ id: `rev-credit-${invoiceId}`, timestamp: Date.now(), type: 'REVERSAL_CREDIT', amountPaise: invoice.totalAmountPaise, invoiceId, customerId: invoice.customerId, workDayId: invoice.workDayId });
    tx.objectStore('accounting').put({ id: `rev-recv-${invoiceId}`, timestamp: Date.now(), type: 'REVERSAL_RECEIVABLE', amountPaise: invoice.totalAmountPaise, invoiceId, customerId: invoice.customerId, workDayId: invoice.workDayId });
    
    const customer = await tx.objectStore('customers').get(invoice.customerId);
    if (customer) {
      customer.outstandingBalancePaise -= invoice.totalAmountPaise;
      tx.objectStore('customers').put(customer);
    }
  }

  // 3. Day Summary updates
  if (summary) {
    summary.totalSalesPaise -= invoice.totalAmountPaise;
    summary.numberOfBills -= 1;
    const itemsCount = invoice.items.reduce((sum, item) => sum + item.quantityPieces, 0);
    summary.itemsSold -= itemsCount;
    await tx.objectStore('workDays').put(summary);
  }

  await tx.done;
}

export async function getInvoices(): Promise<Invoice[]> {
  const db = await getDB();
  return db.getAll('invoices');
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const db = await getDB();
  return db.get('invoices', id);
}

export async function getOutlets(): Promise<Outlet[]> {
  const db = await getDB();
  const outlets = await db.getAll('outlets');
  return outlets.length > 0 ? outlets : SEED_OUTLETS_MONDAY;
}

export async function submitUnloadRequest(
  workDayId: string, 
  cashCollected: number, 
  heldItems: Record<string, number>, 
  unloadedItems: Record<string, number>,
  cashBreakdown?: Record<string, number>,
  cashTotalPaise?: number,
  noteCount?: number,
  coinCount?: number
) {
  const db = await getDB();
  const summary = await db.get('workDays', workDayId);
  if (!summary) throw new Error('Workday not found. Reload and try again.');

  const previousState = summary.state;
  summary.state = 'UNLOAD_REQUESTED';
  summary.cashCollectedPaise = cashCollected;
  summary.heldItems = heldItems;
  summary.unloadedItems = unloadedItems;
  summary.cashBreakdown = cashBreakdown;
  summary.cashTotalPaise = cashTotalPaise;
  summary.noteCount = noteCount;
  summary.coinCount = coinCount;
  await db.put('workDays', summary);

  if (import.meta.env.VITE_USE_MOCK_API === 'false') {
    const { buildDayStockTable } = await import('../domain/stockReconciliation');
    const { calculateAccountingTotals } = await import('../domain/accounting');

    const invoices = (await db.getAll('invoices')).filter(invoice => invoice.workDayId === workDayId);
    const accountingEntries = await db.getAll('accounting');

    const accTotals = calculateAccountingTotals(accountingEntries.filter(entry => entry.workDayId === workDayId));
    const stockRows = await buildDayStockTable(workDayId);
    const productsPayload = stockRows;

    try {
      await apiSubmitUnloadRequest({
        workDayId: summary.workDayId,
        salesmanId: summary.salesmanId,
        vehicleId: summary.vehicleId,
        calendarDate: summary.calendarDate,
        paymentTotals: accTotals,
        billCounts: {
          Cash: invoices.filter(invoice => invoice.paymentMode === 'CASH').length,
          UPI: invoices.filter(invoice => invoice.paymentMode === 'UPI').length,
          Credit: invoices.filter(invoice => invoice.paymentMode === 'CREDIT').length
        },
        cashCollected,
        cashDenominationBreakdown: cashBreakdown || {},
        products: productsPayload
      });
    } catch (error) {
      summary.state = previousState;
      await db.put('workDays', summary);
      throw error;
    }
  }
}

export async function saveCashDraft(workDayId: string, breakdown: Record<string, number>) {
  const db = await getDB();
  await db.put('drafts', breakdown, `cash_draft_${workDayId}`);
}

export async function getCashDraft(workDayId: string): Promise<Record<string, number> | undefined> {
  const db = await getDB();
  return await db.get('drafts', `cash_draft_${workDayId}`);
}

export async function clearCashDraft(workDayId: string) {
  const db = await getDB();
  await db.delete('drafts', `cash_draft_${workDayId}`);
}

export async function adminSendBack(workDayId: string, note: string) {
  const db = await getDB();
  const summary = await db.get('workDays', workDayId);
  if (summary) {
    summary.state = 'SENT_BACK';
    summary.adminNote = note;
    await db.put('workDays', summary);
  }
}

export async function adminApprove(workDayId: string) {
  const db = await getDB();
  const tx = db.transaction(['ledger', 'workDays'], 'readwrite');
  
  const summary = await tx.objectStore('workDays').get(workDayId);
  if (!summary) throw new Error('No summary');

  const allLedger = await tx.objectStore('ledger').getAll();
  const vehicleId = summary.vehicleId;
  const warehouseId = summary.warehouseId;
  const unloadId = `unload-${Date.now()}`;

  const remainingPerProduct = new Map<string, number>();
  const loadedToday = new Map<string, number>();

  for (const entry of allLedger) {
    if (entry.locationId === vehicleId && entry.type !== 'HOLD_CARRY_FORWARD') {
      remainingPerProduct.set(entry.productId, (remainingPerProduct.get(entry.productId) || 0) + entry.quantityPieces);
    }
    if (entry.locationId === vehicleId && entry.type === 'LOAD_IN' && entry.workDayId === workDayId) {
      loadedToday.set(entry.productId, (loadedToday.get(entry.productId) || 0) + entry.quantityPieces);
    }
  }

  const unloadedItems = summary.unloadedItems || {};
  const heldItems = summary.heldItems || {};

  // If no unload/hold data exists (legacy request), default to unloading everything
  const hasUnloadData = summary.unloadedItems !== undefined;

  for (const [productId, qty] of remainingPerProduct.entries()) {
    if (qty > 0) {
      const unloadQty = hasUnloadData ? (unloadedItems[productId] || 0) : qty;
      const holdQty = hasUnloadData ? (heldItems[productId] || 0) : 0;

      if (unloadQty > 0) {
        tx.objectStore('ledger').put({
          id: `${unloadId}-out-${productId}`, referenceId: unloadId, timestamp: Date.now(),
          type: 'UNLOAD_OUT', productId: productId, quantityPieces: -unloadQty, locationId: vehicleId
        });
        tx.objectStore('ledger').put({
          id: `${unloadId}-in-${productId}`, referenceId: unloadId, timestamp: Date.now(),
          type: 'UNLOAD_IN', productId: productId, quantityPieces: unloadQty, locationId: warehouseId
        });
      }

      if (holdQty > 0) {
        tx.objectStore('ledger').put({
          id: `${unloadId}-hold-${productId}`, referenceId: unloadId, timestamp: Date.now(),
          type: 'HOLD_CARRY_FORWARD', productId: productId, quantityPieces: holdQty, locationId: vehicleId
        });
      }
    }
  }

  // Update ring buffer for historical stock levels
  if (!summary.historicalStockLevels) {
    summary.historicalStockLevels = {};
  }
  for (const p of SEED_PRODUCTS) {
    const opening = summary.openingStockSnapshot[p.id] || 0;
    const loaded = loadedToday.get(p.id) || 0;
    const totalStart = opening + loaded;
    
    const history = summary.historicalStockLevels[p.id] || [];
    history.push(totalStart);
    if (history.length > 7) {
      history.shift();
    }
    summary.historicalStockLevels[p.id] = history;
  }

  summary.state = 'CLOSED';
  summary.closedAt = Date.now();
  summary.adminNote = 'Job cleared';
  await tx.objectStore('workDays').put(summary);

  await tx.done;

  // After the ledger entries are finalized, generate and save the frozen stock report
  try {
    const { getDayStockReport } = await import('../domain/dayStockReport');
    const report = await getDayStockReport(workDayId);
    
    // We open a new transaction just to save the snapshot
    const snapTx = db.transaction('workDays', 'readwrite');
    const snapSummary = await snapTx.objectStore('workDays').get(workDayId);
    if (snapSummary) {
      const snapObj: Record<string, any> = {};
      for (const row of report) {
        snapObj[row.productId] = row;
      }
      snapSummary.dayStockReportSnapshot = snapObj;
      await snapTx.objectStore('workDays').put(snapSummary);
    }
    await snapTx.done;
  } catch (e) {
    console.error('Failed to generate day stock report snapshot', e);
  }
}

export async function getAccountingEntries(): Promise<AccountingLedgerEntry[]> {
  const db = await getDB();
  return db.getAll('accounting');
}

export async function getAllWorkDays(): Promise<WorkDay[]> {
  const db = await getDB();
  return db.getAll('workDays');
}

export async function syncUnloadStateFromServer(workDayId: string, status: string, adminNote: string) {
  const db = await getDB();
  const summary = await db.get('workDays', workDayId);
  if (summary) {
    if (status === 'SENT_BACK') {
      summary.state = 'SENT_BACK';
      summary.adminNote = adminNote;
      await db.put('workDays', summary);
    } else if (status === 'APPROVED' && summary.state !== 'CLOSED') {
      // Actually apply approve logic
      await adminApprove(workDayId);
    }
  }
}
