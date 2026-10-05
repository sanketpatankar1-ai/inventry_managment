import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StockLedgerEntry, Invoice, Outlet, LoadEvent, Customer, AccountingLedgerEntry, WorkDay } from '../domain/types';

interface SalesmanDB extends DBSchema {
  ledger: { 
    key: string; 
    value: StockLedgerEntry; 
    indexes: { 'by-workDayId': string }
  };
  invoices: { 
    key: string; 
    value: Invoice; 
    indexes: { 
      'by-calendarDate': string, 
      'by-customerId': string, 
      'by-workDayId': string, 
      'by-paymentMode': string 
    } 
  };
  workDays: { key: string; value: WorkDay; };
  outlets: { key: string; value: Outlet; };
  loads: { key: string; value: LoadEvent; };
  customers: { key: string; value: Customer; indexes: { 'by-mobile': string } };
  accounting: { key: string; value: AccountingLedgerEntry; };
  drafts: { key: string; value: any; };
}

let dbPromise: Promise<IDBPDatabase<SalesmanDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SalesmanDB>('salesman-db-v3', 6, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('ledger')) db.createObjectStore('ledger', { keyPath: 'id' });
        
        let invStore;
        if (!db.objectStoreNames.contains('invoices')) {
          invStore = db.createObjectStore('invoices', { keyPath: 'id' });
        } else {
          invStore = transaction.objectStore('invoices');
        }
        
        // Add indexes to invoices if they don't exist
        if (!invStore.indexNames.contains('by-calendarDate')) invStore.createIndex('by-calendarDate', 'calendarDate');
        if (!invStore.indexNames.contains('by-customerId')) invStore.createIndex('by-customerId', 'customerId');
        if (!invStore.indexNames.contains('by-workDayId')) invStore.createIndex('by-workDayId', 'workDayId');
        if (!invStore.indexNames.contains('by-paymentMode')) invStore.createIndex('by-paymentMode', 'paymentMode');
        
        // Remove old dayState store if it exists
        if (db.objectStoreNames.contains('dayState' as any)) {
          db.deleteObjectStore('dayState' as any);
        }
        
        let workDaysStore;
        if (!db.objectStoreNames.contains('workDays')) {
          workDaysStore = db.createObjectStore('workDays', { keyPath: 'workDayId' });
        } else {
          workDaysStore = transaction.objectStore('workDays');
        }
        
        if (!db.objectStoreNames.contains('outlets')) db.createObjectStore('outlets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('loads')) db.createObjectStore('loads', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('customers')) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('by-mobile', 'mobile', { unique: true });
        }
        
        let accStore;
        if (!db.objectStoreNames.contains('accounting')) {
          accStore = db.createObjectStore('accounting', { keyPath: 'id' });
        } else {
          accStore = transaction.objectStore('accounting');
        }
        
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts');
        }

        // Data migration (timestamp -> createdAt, assign calendarDate, group into legacy WorkDays)
        if (oldVersion < 5) {
          const allInvoices = await invStore.getAll();
          const legacyDates = new Set<string>();
          
          const invPuts = [];
          for (const inv of allInvoices) {
            let changed = false;
            if ((inv as any).timestamp !== undefined) {
              inv.createdAt = (inv as any).timestamp;
              delete (inv as any).timestamp;
              changed = true;
            }
            if (!inv.calendarDate) {
              const d = new Date(inv.createdAt);
              // Local time YYYY-MM-DD
              const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
              inv.calendarDate = dateStr;
              changed = true;
            }
            if (!inv.workDayId) {
              inv.workDayId = `legacy-wd-${inv.calendarDate}`;
              legacyDates.add(inv.calendarDate);
              changed = true;
            }
            if (!inv.status) {
              inv.status = 'VALID';
              changed = true;
            } else if (inv.status === 'ACTIVE' as any) {
              inv.status = 'VALID';
              changed = true;
            }
            if (changed) invPuts.push(invStore.put(inv));
          }
          await Promise.all(invPuts);

          // Generate legacy work days for these missing ones
          const wdPuts = [];
          for (const dateStr of legacyDates) {
            const wdId = `legacy-wd-${dateStr}`;
            const existing = await workDaysStore.get(wdId);
            if (!existing) {
              wdPuts.push(workDaysStore.put({
                workDayId: wdId,
                calendarDate: dateStr,
                state: 'CLOSED',
                salesmanId: 'sm-dewas', // defaults for legacy
                vehicleId: 'veh-dewas-1',
                warehouseId: 'wh-dewas',
                routeId: 'rt-1',
                openedAt: new Date(dateStr).getTime(),
                closedAt: new Date(dateStr).getTime() + 1000,
                openingStockSnapshot: {},
                cashCollectedPaise: 0,
                invoiceCounter: 0,
                totalSalesPaise: 0,
                cashSalesPaise: 0,
                upiSalesPaise: 0,
                creditSalesPaise: 0,
                numberOfBills: 0,
                itemsSold: 0
              }));
            }
          }
          await Promise.all(wdPuts);

          // Ledger missing workDayId
          const ledgerStore = transaction.objectStore('ledger');
          const allLedger = await ledgerStore.getAll();
          const ledgerPuts = [];
          for (const l of allLedger) {
            if (!l.workDayId) {
              const d = new Date(l.timestamp);
              const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
              l.workDayId = `legacy-wd-${dateStr}`;
              ledgerPuts.push(ledgerStore.put(l));
            }
          }
          await Promise.all(ledgerPuts);

          // Accounting missing workDayId
          const allAcc = await accStore.getAll();
          const accPuts = [];
          for (const a of allAcc) {
            if (!a.workDayId) {
              const d = new Date(a.timestamp);
              const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
              a.workDayId = `legacy-wd-${dateStr}`;
              accPuts.push(accStore.put(a));
            }
          }
          await Promise.all(accPuts);
        }
        if (oldVersion < 6) {
          const ledgerStore = transaction.objectStore('ledger');
          if (!ledgerStore.indexNames.contains('by-workDayId')) {
            ledgerStore.createIndex('by-workDayId', 'workDayId');
          }

          const loadStore = transaction.objectStore('loads');
          const allLoads = await loadStore.getAll();
          const loadPuts = [];
          for (const load of allLoads) {
            if (!load.phase) {
              // try to fetch workDay
              const wd = await workDaysStore.get(load.workDayId);
              if (wd && wd.routeStartedAt && load.timestamp >= wd.routeStartedAt) {
                load.phase = 'TOPUP';
              } else {
                load.phase = 'START';
              }
              loadPuts.push(loadStore.put(load));
            }
          }
          await Promise.all(loadPuts);
        }
      },
      blocked() {
        console.warn('IDB Upgrade blocked: Please close other tabs of this app!');
        alert('Database upgrade blocked. Please close other tabs of this app and reload.');
      },
      blocking() {
        console.warn('IDB Upgrade blocking: closing connection');
        if (dbPromise) {
          dbPromise.then(db => db.close());
          dbPromise = null;
        }
      }
    });
  }
  return dbPromise;
}

export async function clearAllData() {
  const db = await getDB();
  await db.clear('ledger');
  await db.clear('invoices');
  await db.clear('workDays');
  await db.clear('outlets');
  await db.clear('loads');
  await db.clear('customers');
  await db.clear('accounting');
}
