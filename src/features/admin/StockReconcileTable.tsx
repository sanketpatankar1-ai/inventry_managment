import React, { useState, useMemo } from 'react';
import { DayStockReportRow } from '../../domain/types';
import { productMap } from '../../data/seedData';
import { formatQuantity } from '../../domain/units';
import { Download, Printer, Check, ChevronDown, ChevronRight } from 'lucide-react';

export default function StockReconcileTable({ 
  report, 
  salesman, 
  vehicle, 
  date,
  billsTotalRs
}: { 
  report: DayStockReportRow[];
  salesman?: string;
  vehicle?: string;
  date?: string;
  billsTotalRs?: number;
}) {
  const [unitMode, setUnitMode] = useState<'NATURAL' | 'PIECES'>('NATURAL');
  const [showAll, setShowAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (productId: string) => {
    const next = new Set(expandedRows);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setExpandedRows(next);
  };

  const displayData = useMemo(() => {
    let data = report;
    if (!showAll) {
      data = data.filter(r => r.totalAvailable > 0 || r.sold > 0);
    }
    return [...data].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [report, showAll]);

  const renderQty = (qty: number, productId: string) => {
    if (unitMode === 'PIECES') return `${qty}`;
    const p = productMap.get(productId)!;
    return formatQuantity(qty, p);
  };

  const totals = useMemo(() => {
    let opening = 0, loadedAtStart = 0, topUp = 0, totalAvailable = 0;
    let sold = 0, expectedRemaining = 0, countedRemaining = 0;
    let difference = 0, holdQty = 0, unloadQty = 0, salesRs = 0;
    for (const r of report) {
      opening += r.opening;
      loadedAtStart += r.loadedAtStart;
      topUp += r.topUp;
      totalAvailable += r.totalAvailable;
      sold += r.sold;
      expectedRemaining += r.expectedRemaining;
      countedRemaining += r.countedRemaining;
      difference += r.difference;
      holdQty += r.holdQty;
      unloadQty += r.unloadQty;
      salesRs += r.salesRs;
    }
    return { opening, loadedAtStart, topUp, totalAvailable, sold, expectedRemaining, countedRemaining, difference, holdQty, unloadQty, salesRs };
  }, [report]);

  const handleDownloadCSV = () => {
    const headers = ['Product', 'Opening', 'Loaded', 'Top-up', 'Total Start', 'Sold', 'Expected', 'Counted', 'Difference', 'Hold', 'Unload', 'Sales Rs'];
    const rows = report.map(r => [
      r.productName, r.opening, r.loadedAtStart, r.topUp, r.totalAvailable, r.sold, r.expectedRemaining, r.countedRemaining, r.difference, r.holdQty, r.unloadQty, r.salesRs.toFixed(2)
    ]);
    const csvContent = [headers.join(',')]
      .concat(rows.map(e => e.join(',')))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Reconciliation_${date || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (report.length === 0) {
    return <div className="text-gray-500 p-4 text-center border border-gray-100 rounded-lg">No stock data available</div>;
  }

  if (displayData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">Stock Reconciliation</h3>
          <label className="flex items-center space-x-1 cursor-pointer text-sm">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
            <span>Show all products</span>
          </label>
        </div>
        <div className="text-gray-500 p-8 text-center">
          No stock movement recorded for this day yet.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center print:hidden flex-wrap gap-2">
        <h3 className="font-bold text-gray-800 dark:text-gray-200">Stock Reconciliation</h3>
        <div className="flex space-x-3 text-sm items-center">
          <select 
            value={unitMode} 
            onChange={e => setUnitMode(e.target.value as any)}
            className="border-gray-300 rounded text-sm py-1"
          >
            <option value="NATURAL">Boxes / Strips / Pieces</option>
            <option value="PIECES">All in pieces</option>
          </select>
          <label className="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
            <span>Show all products</span>
          </label>
          <button onClick={handleDownloadCSV} className="text-blue-600 font-bold flex items-center"><Download size={16} className="mr-1"/> CSV</button>
          <button onClick={() => window.print()} className="text-blue-600 font-bold flex items-center"><Printer size={16} className="mr-1"/> Print</button>
        </div>
      </div>

      <div className="hidden print:block p-4 border-b">
        <h2 className="text-xl font-bold">Stock Reconciliation</h2>
        <div className="flex justify-between text-sm mt-2">
          <span>Date: {date}</span>
          <span>Salesman: {salesman}</span>
          <span>Vehicle: {vehicle}</span>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 font-bold w-48">Product</th>
              <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 w-48 text-center bg-gray-100/50">Start of day</th>
              <th className="px-4 py-3 text-center">Sold</th>
              <th className="px-4 py-3 text-center bg-blue-50/30">Remaining<br/><span className="text-[10px] font-normal lowercase">(expected)</span></th>
              <th className="px-4 py-3 text-center">Counted</th>
              <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center">Difference</th>
              <th className="px-4 py-3 text-center text-amber-700">Hold</th>
              <th className="px-4 py-3 text-center text-blue-700">Unload</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row) => {
              const isExpanded = expandedRows.has(row.productId);
              return (
                <React.Fragment key={row.productId}>
                  <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(row.productId)}>
                    <td className="px-4 py-2 sticky left-0 z-10 font-medium truncate max-w-[200px] bg-white flex items-center gap-1 border-r border-gray-100">
                      {isExpanded ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>}
                      {row.productName}
                      {row.expectedRemaining === 0 && row.totalAvailable > 0 && <span className="ml-2 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Sold out</span>}
                      {row.cancelledBillsCount > 0 && <span className="block text-[10px] text-gray-400 font-normal">({row.cancelledBillsCount} void)</span>}
                    </td>
                    <td className="px-4 py-2 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-100/30">
                      <div className="font-bold">{renderQty(row.totalAvailable, row.productId)}</div>
                      <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                        {row.opening > 0 && <span>Opening {renderQty(row.opening, row.productId)}</span>}
                        {row.opening > 0 && row.loadedAtStart + row.topUp > 0 && <span> + </span>}
                        {row.loadedAtStart + row.topUp > 0 && <span>Loaded {renderQty(row.loadedAtStart + row.topUp, row.productId)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">{renderQty(row.sold, row.productId)}</td>
                    <td className="px-4 py-2 text-center font-bold bg-blue-50/30">{renderQty(row.expectedRemaining, row.productId)}</td>
                    <td className="px-4 py-2 text-center font-bold">{renderQty(row.countedRemaining, row.productId)}</td>
                    <td className="px-4 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                      {row.difference === 0 ? (
                        <div className="flex justify-center text-green-600"><Check size={16}/></div>
                      ) : row.difference < 0 ? (
                        <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">Short {renderQty(Math.abs(row.difference), row.productId)}</span>
                      ) : (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded text-xs">Extra {renderQty(row.difference, row.productId)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center font-medium text-amber-700 bg-amber-50/30">{renderQty(row.holdQty, row.productId)}</td>
                    <td className="px-4 py-2 text-center font-medium text-blue-700 bg-blue-50/30">{renderQty(row.unloadQty, row.productId)}</td>
                  </tr>
                  
                  {isExpanded && row.timeline.length > 0 && (
                    <tr className="bg-gray-50/80 border-b border-gray-100 dark:bg-gray-800/80">
                      <td colSpan={8} className="px-4 py-3 text-xs text-gray-600">
                        <div className="flex flex-col gap-1 ml-6 border-l-2 border-gray-200 pl-3">
                          {row.timeline.map((event, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-gray-400 w-12">{event.time}</span>
                              <span className="font-medium text-gray-700">{event.desc}</span>
                              <span className="text-blue-600 font-medium">{renderQty(event.qtyPieces, row.productId)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900 font-bold border-t border-gray-200">
            <tr>
              <td className="px-4 py-3 sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 border-r border-gray-100">Total Pieces</td>
              <td className="px-4 py-3 text-center border-r border-gray-200">{totals.totalAvailable}</td>
              <td className="px-4 py-3 text-center">{totals.sold}</td>
              <td className="px-4 py-3 text-center bg-blue-50/50">{totals.expectedRemaining}</td>
              <td className="px-4 py-3 text-center">{totals.countedRemaining}</td>
              <td className="px-4 py-3 text-center border-r border-gray-200">{totals.difference}</td>
              <td className="px-4 py-3 text-center bg-amber-50/50">{totals.holdQty}</td>
              <td className="px-4 py-3 text-center bg-blue-50/50">{totals.unloadQty}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {billsTotalRs !== undefined && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-sm flex items-center justify-center">
          <span className="text-gray-600 dark:text-gray-400 mr-2">Sold stock value ₹{totals.salesRs.toFixed(2)} vs total sales ₹{billsTotalRs.toFixed(2)}:</span>
          {Math.abs(totals.salesRs - billsTotalRs) < 0.01 ? (
            <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded flex items-center gap-1">
              <Check size={14} /> Stock and sales match
            </span>
          ) : (
            <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
              MISMATCH by ₹{Math.abs(totals.salesRs - billsTotalRs).toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
