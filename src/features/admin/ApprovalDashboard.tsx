import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock3, RotateCcw, XCircle } from 'lucide-react';
import { adminApprove, adminSendBack, getAccountingEntries, getAllWorkDays } from '../../data/mockApi';
import { AccountingLedgerEntry, WorkDay } from '../../domain/types';
import { calculateAccountingTotals } from '../../domain/accounting';
import { formatRupees } from '../../domain/money';

export default function ApprovalDashboard() {
  const navigate = useNavigate();
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [accounting, setAccounting] = useState<AccountingLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyDayId, setBusyDayId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [days, entries] = await Promise.all([getAllWorkDays(), getAccountingEntries()]);
      setWorkDays(days.sort((a, b) => b.openedAt - a.openedAt));
      setAccounting(entries);
      setError('');
    } catch (loadError) {
      console.error('Failed to load admin approval dashboard', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load workday submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const pendingDays = useMemo(
    () => workDays.filter(day => day.state === 'UNLOAD_REQUESTED' || day.state === 'SENT_BACK'),
    [workDays]
  );

  const handleApprove = async (day: WorkDay) => {
    if (!window.confirm(`Approve ${day.salesmanId}'s end-of-day report for ${day.calendarDate}? This will complete the job.`)) return;
    setBusyDayId(day.workDayId);
    setError('');
    try {
      await adminApprove(day.workDayId);
      await refresh();
    } catch (actionError) {
      console.error('Failed to approve workday', actionError);
      setError(actionError instanceof Error ? actionError.message : 'Could not approve this report.');
    } finally {
      setBusyDayId('');
    }
  };

  const handleSendBack = async (day: WorkDay) => {
    const note = window.prompt('Tell the salesman what needs to be corrected:');
    if (note === null) return;
    if (!note.trim()) {
      setError('Enter a reason before sending the report back.');
      return;
    }
    setBusyDayId(day.workDayId);
    setError('');
    try {
      await adminSendBack(day.workDayId, note.trim());
      await refresh();
    } catch (actionError) {
      console.error('Failed to return workday report', actionError);
      setError(actionError instanceof Error ? actionError.message : 'Could not return this report.');
    } finally {
      setBusyDayId('');
    }
  };

  if (loading) return <div className="p-4">Loading approval dashboard...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} aria-label="Back to home" className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h2 className="text-xl font-bold">Admin Approvals</h2>
            <p className="text-sm text-gray-500">Review end-of-day reports and complete jobs</p>
          </div>
        </div>
        <button onClick={() => void refresh()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm dark:bg-gray-800">
          <RotateCcw size={16} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300"><Clock3 size={17} /> Waiting for review</div>
          <div className="mt-2 text-3xl font-bold">{pendingDays.filter(day => day.state === 'UNLOAD_REQUESTED').length}</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 text-sm font-bold text-green-800 dark:text-green-300"><CheckCircle size={17} /> Approved today</div>
          <div className="mt-2 text-3xl font-bold">{workDays.filter(day => day.state === 'CLOSED' && day.calendarDate === new Date().toLocaleDateString('en-CA')).length}</div>
        </div>
      </div>

      {pendingDays.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <CheckCircle className="mx-auto mb-3 text-green-500" size={36} />
          <h3 className="font-bold">No reports waiting for approval</h3>
          <p className="mt-1 text-sm text-gray-500">Salesman end-of-day submissions will appear here.</p>
        </div>
      ) : pendingDays.map(day => {
        const totals = calculateAccountingTotals(accounting.filter(entry => entry.workDayId === day.workDayId));
        const isBusy = busyDayId === day.workDayId;
        return (
          <article key={day.workDayId} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{day.salesmanId}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${day.state === 'SENT_BACK' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                    {day.state === 'SENT_BACK' ? 'Sent back' : 'Needs approval'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{day.calendarDate} · {day.vehicleId} · {day.workDayId}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase text-gray-500">Sales total</div>
                <div className="text-xl font-bold">{formatRupees(totals.total)}</div>
              </div>
            </div>

            {day.adminNote && day.state === 'SENT_BACK' && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{day.adminNote}</p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Cash', totals.cash],
                ['UPI', totals.upi],
                ['Credit', totals.credit],
                ['Cash counted', day.cashTotalPaise ?? day.cashCollectedPaise]
              ].map(([label, amount]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <div className="text-xs font-semibold text-gray-500">{label}</div>
                  <div className="mt-1 font-bold">{formatRupees(Number(amount))}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                disabled={isBusy || day.state !== 'UNLOAD_REQUESTED'}
                onClick={() => void handleApprove(day)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle size={18} /> {isBusy ? 'Working...' : 'Approve & Complete Job'}
              </button>
              <button
                disabled={isBusy || day.state !== 'UNLOAD_REQUESTED'}
                onClick={() => void handleSendBack(day)}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300"
              >
                <XCircle size={18} /> Send back
              </button>
            </div>
          </article>
        );
      })}
      <p className="text-center text-xs text-gray-500">This dashboard reads approvals stored in this browser. Shared approvals across devices require a connected admin backend.</p>
    </div>
  );
}
