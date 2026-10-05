import { getDayStockReport } from './src/domain/dayStockReport.ts';
import { getDB } from './src/data/db.ts';

async function run() {
  const db = await getDB();
  const allDays = await db.getAll('workDays');
  const d = allDays.sort((a,b) => b.openedAt - a.openedAt)[0];
  if (!d) return console.log("No days");
  console.log("Day:", d.workDayId, d.state);
  const rep = await getDayStockReport(d.workDayId);
  console.log("Report length:", rep.length);
}
run();
