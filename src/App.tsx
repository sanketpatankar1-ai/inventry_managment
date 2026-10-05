import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Home, Map as MapIcon, Package, FileText, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import { fetchActiveWorkDay, seedInitialData, syncUnloadStateFromServer } from './data/mockApi';
import { apiGetUnloadRequest } from './data/apiClient';
import LoginPage from './features/Login';

// Pages
import HomePage from './features/Home';
import RoutePage from './features/RouteList';
import StockPage from './features/VehicleStock';
import SummaryPage from './features/SummaryTabs';
import LoadStockPage from './features/LoadStock';
import UnloadPage from './features/Unload';
import InvoicePrintPage from './features/InvoicePrint';

// Direct Sell Pages
import CustomerSelectPage from './features/direct-sell/CustomerSelect';
import CustomerAddPage from './features/direct-sell/CustomerAdd';
import DirectSaleEntryPage from './features/direct-sell/SaleEntry';
import CustomerDetail from './features/customers/CustomerDetail';
import ApprovalDashboard from './features/admin/ApprovalDashboard';

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Route', path: '/route', icon: MapIcon },
    { name: 'Sell', path: '/sell', icon: ShoppingCart },
    { name: 'Stock', path: '/stock', icon: Package },
    { name: 'Summary', path: '/summary', icon: FileText },
  ];

  // Hide nav on print screen
  if (location.pathname.startsWith('/print')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe print:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path) && (tab.path !== '/' || location.pathname === '/');
          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPrint = location.pathname.startsWith('/print');

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 ${!isPrint ? 'pb-16' : ''}`}>
      {!isPrint && !location.pathname.startsWith('/sell') && (
        <header className="bg-white dark:bg-gray-900 shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-40 print:hidden">
          <h1 className="text-lg font-bold">Salesman Dashboard</h1>
          <div className="flex items-center space-x-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Online</span>
          </div>
        </header>
      )}
      <main className={isPrint || location.pathname.startsWith('/sell') ? '' : 'p-4'}>{children}</main>
      <BottomNav />
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('salesman_session')) {
      setIsAuthenticated(true);
    }
    Promise.all([fetchActiveWorkDay(), seedInitialData()])
      .then(() => setLoading(false))
      .catch(e => {
        console.error(e);
        alert('DB Init Error: ' + e.message);
        setLoading(false);
      });
  }, []);


  useEffect(() => {
    let intervalId: any;
    
    const checkStatus = async () => {
      if (import.meta.env.VITE_USE_MOCK_API === 'false') {
        const day = await fetchActiveWorkDay();
        if (day.state === 'UNLOAD_REQUESTED') {
          try {
             const res = await apiGetUnloadRequest(day.workDayId);
             if (res === null) {
                await syncUnloadStateFromServer(day.workDayId, 'SENT_BACK', 'Server was reset. Please submit again.');
                window.location.reload();
             } else if (res) {
                const newStatus = res.status;
                if (newStatus === 'SENT_BACK' || newStatus === 'APPROVED') {
                  await syncUnloadStateFromServer(day.workDayId, newStatus, res.adminNote);
                  window.location.reload();
                }
             }
          } catch(e) {
             console.error("Polling error", e);
          }
        }
      }
    };

    if (isAuthenticated) {
      checkStatus();
      intervalId = setInterval(checkStatus, 20000);
      window.addEventListener('focus', checkStatus);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('focus', checkStatus);
    };
  }, [isAuthenticated]);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">Loading DB...</div>;

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/route" element={<Layout><RoutePage /></Layout>} />
        
        {/* Direct Sell Flow */}
        <Route path="/sell" element={<Layout><CustomerSelectPage /></Layout>} />
        <Route path="/sell/new-customer" element={<Layout><CustomerAddPage /></Layout>} />
        <Route path="/sell/:customerId" element={<Layout><DirectSaleEntryPage /></Layout>} />
        <Route path="/customer/:customerId" element={<Layout><CustomerDetail /></Layout>} />
        
        {/* Fallback for old route-based sales */}
        <Route path="/sale/:outletId" element={<Navigate to="/sell/walk-in" replace />} />

        <Route path="/stock" element={<Layout><StockPage /></Layout>} />
        <Route path="/summary" element={<Layout><SummaryPage /></Layout>} />
        <Route path="/admin" element={<Layout><ApprovalDashboard /></Layout>} />
        <Route path="/load-stock" element={<Layout><LoadStockPage /></Layout>} />
        <Route path="/unload" element={<Layout><UnloadPage /></Layout>} />
        <Route path="/print/:invoiceId" element={<Layout><InvoicePrintPage /></Layout>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
