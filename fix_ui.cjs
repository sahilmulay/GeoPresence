const fs = require('fs');
let code = fs.readFileSync('src/pages/employee/Dashboard.jsx', 'utf8');
code = code.replace(/`\{t\('emp_dash\.checked_in_at'\)\} /g, "`${t('emp_dash.checked_in_at')} ");
code = code.replace(/`\{t\('emp_dash\.checked_out_at'\)\} /g, "`${t('emp_dash.checked_out_at')} ");
fs.writeFileSync('src/pages/employee/Dashboard.jsx', code);
