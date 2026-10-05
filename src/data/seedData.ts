import { Product, Outlet, Customer } from '../domain/types';

export const WAREHOUSE_HARDPIPLYA = 'wh-hardpiplya';
export const WAREHOUSE_DEWAS = 'wh-dewas';

export const VEHICLE_HARDPIPLYA = 'veh-hardpiplya-1';
export const VEHICLE_DEWAS = 'veh-dewas-1';

export const SALESMAN_HARDPIPLYA = 'sm-hardpiplya';
export const SALESMAN_DEWAS = 'sm-dewas';

export const SEED_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Rs5 Chips', pricePaise: 500, unitsPerStrip: 12, stripsPerBox: 12, piecesPerBox: 144 },
  { id: 'p2', name: 'Rs10 Chips', pricePaise: 1000, unitsPerStrip: 10, stripsPerBox: 10, piecesPerBox: 100 },
  { id: 'p3', name: 'Rs5 Biscuits', pricePaise: 500, unitsPerStrip: 15, stripsPerBox: 8, piecesPerBox: 120 },
  { id: 'p4', name: 'Rs20 Juice', pricePaise: 2000, unitsPerStrip: 6, stripsPerBox: 4, piecesPerBox: 24 },
  { id: 'p5', name: 'Rs1 Candy', pricePaise: 100, unitsPerStrip: 50, stripsPerBox: 10, piecesPerBox: 500 },
  { id: 'p6', name: 'Rs50 Soap', pricePaise: 5000, unitsPerStrip: 4, stripsPerBox: 6, piecesPerBox: 24 },
  { id: 'p7', name: 'Rs100 Shampoo', pricePaise: 10000, unitsPerStrip: 1, stripsPerBox: 12, piecesPerBox: 12 },
];

export const productMap = new Map<string, Product>();
SEED_PRODUCTS.forEach(p => productMap.set(p.id, p));

export const SEED_OUTLETS_MONDAY: Outlet[] = [
  { id: 'o1', name: 'Kirana Store A', status: 'Pending' },
  { id: 'o2', name: 'Supermart B', status: 'Pending' },
  { id: 'o3', name: 'Corner Shop C', status: 'Pending' },
  { id: 'o4', name: 'Daily Needs D', status: 'Pending' },
];

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Ramesh Kumar', mobile: '9876543210', shopName: 'Ramesh Kirana', area: 'Station Road', outstandingBalancePaise: 0 },
  { id: 'c2', name: 'Suresh Patel', mobile: '9876543211', shopName: 'Patel Supermart', area: 'MG Road', outstandingBalancePaise: 50000, creditLimitPaise: 100000 },
  { id: 'c3', name: 'Dinesh Singh', mobile: '9876543212', shopName: 'Singh Daily Needs', area: 'Civil Lines', outstandingBalancePaise: 120000, creditLimitPaise: 150000 },
  { id: 'c4', name: 'Ganesh General', mobile: '9876543213', area: 'Old City', outstandingBalancePaise: 0 },
  { id: 'c5', name: 'Vikas Sharma', mobile: '9876543214', shopName: 'Sharma Traders', area: 'Station Road', outstandingBalancePaise: 15000 },
  { id: 'c6', name: 'Manoj Tiwari', mobile: '9876543215', shopName: 'Tiwari Kirana', area: 'New Colony', outstandingBalancePaise: 0 },
  { id: 'c7', name: 'Kamlesh Joshi', mobile: '9876543216', shopName: 'Joshi Provision', outstandingBalancePaise: 5000 },
  { id: 'c8', name: 'Rajesh Verma', mobile: '9876543217', shopName: 'Verma Brothers', area: 'MG Road', outstandingBalancePaise: 0 },
  { id: 'c9', name: 'Sunil Rathore', mobile: '9876543218', area: 'Civil Lines', outstandingBalancePaise: 8000, creditLimitPaise: 20000 },
  { id: 'c10', name: 'Anil Gupta', mobile: '9876543219', shopName: 'Gupta General Store', area: 'Old City', outstandingBalancePaise: 0 },
  { id: 'c11', name: 'Pramod Desai', mobile: '9876543220', shopName: 'Desai Mart', outstandingBalancePaise: 45000 },
  { id: 'c12', name: 'Vijay Yadav', mobile: '9876543221', area: 'Station Road', outstandingBalancePaise: 0 },
  { id: 'c13', name: 'Sanjay Jain', mobile: '9876543222', shopName: 'Jain Enterprises', area: 'New Colony', outstandingBalancePaise: 0 },
  { id: 'c14', name: 'Mahesh Chouhan', mobile: '9876543223', shopName: 'Chouhan Kirana', area: 'MG Road', outstandingBalancePaise: 2000 },
  { id: 'c15', name: 'Alok Mishra', mobile: '9876543224', area: 'Civil Lines', outstandingBalancePaise: 0 },
];
