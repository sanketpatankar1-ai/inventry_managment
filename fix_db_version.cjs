const fs = require('fs');
let code = fs.readFileSync('src/data/db.ts', 'utf8');
code = code.replace(
  /dbPromise = openDB<SalesmanDB>\('salesman-db-v3', 5, \{/,
  `dbPromise = openDB<SalesmanDB>('salesman-db-v3', 6, {`
);
fs.writeFileSync('src/data/db.ts', code);
