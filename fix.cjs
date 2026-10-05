const fs = require('fs');
let code = fs.readFileSync('src/features/history/HistoryDayDetail.tsx', 'utf8');
code = code.replace(/<StockSummaryTable status={day.state}\s+report={report}\s+[^>]*>/, '<StockSummaryTable status={day.state} report={report} />');
fs.writeFileSync('src/features/history/HistoryDayDetail.tsx', code);
