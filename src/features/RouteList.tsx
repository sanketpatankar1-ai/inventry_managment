import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from '../domain/types';
import { getOutlets, fetchActiveWorkDay } from '../data/mockApi';
import { Store, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function RouteList() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [canSell, setCanSell] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getOutlets().then(setOutlets);
    fetchActiveWorkDay().then(summary => setCanSell(summary.state === 'ON_ROUTE'));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-2">Today's Route</h2>
      
      {!canSell && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-4 rounded-xl text-sm mb-4">
          You must start the route from the Home tab before you can make sales.
        </div>
      )}

      <div className="space-y-3">
        {outlets.map((outlet) => {
          const isVisited = outlet.status === 'Visited';
          return (
            <button
              key={outlet.id}
              disabled={!canSell}
              onClick={() => navigate(`/sale/${outlet.id}`)}
              className={clsx(
                "w-full text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border transition-colors flex items-center justify-between",
                !canSell ? "opacity-60 cursor-not-allowed" : "hover:border-blue-300 active:scale-[0.98]",
                isVisited ? "border-green-200 dark:border-green-900" : "border-gray-100 dark:border-gray-700"
              )}
            >
              <div className="flex items-center space-x-4">
                <div className={clsx(
                  "p-3 rounded-full",
                  isVisited ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300" : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                )}>
                  <Store size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{outlet.name}</h3>
                  <div className="flex items-center text-sm mt-1 text-gray-500">
                    {isVisited ? <CheckCircle size={14} className="mr-1 text-green-500" /> : <Clock size={14} className="mr-1" />}
                    {outlet.status}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
