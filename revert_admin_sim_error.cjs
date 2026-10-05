const fs = require('fs');
let code = fs.readFileSync('src/features/AdminSim.tsx', 'utf8');

code = code.replace(
  /const \[stockReport, setStockReport\] = useState<DayStockReportRow\[\]>\(\[\]\);\n  const \[loadError, setLoadError\] = useState<string>\(""\);/,
  `const [stockReport, setStockReport] = useState<DayStockReportRow[]>([]);`
);
code = code.replace(
  /try \{\n      const report = await buildDayStockTable\(s\.workDayId\);\n      setStockReport\(report\);\n    \} catch \(e: any\) \{\n      setLoadError\(e\.message \|\| String\(e\)\);\n    \}/,
  `const report = await buildDayStockTable(s.workDayId);
    setStockReport(report);`
);
code = code.replace(
  /\{loadError \? <div className="p-4 text-red-500 font-bold border border-red-500">Error: \{loadError\}<\/div> : <StockSummaryTable report=\{stockReport\} status=\{summary\.state\} \/>\}/,
  `<StockSummaryTable report={stockReport} status={summary.state} />`
);
fs.writeFileSync('src/features/AdminSim.tsx', code);
