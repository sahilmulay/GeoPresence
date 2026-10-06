const fs = require('fs');

// Fix Login
let loginCode = fs.readFileSync('src/pages/auth/Login.jsx', 'utf8');
loginCode = loginCode.replace(/onChange=\{\(e\) => set\{t\('auth\.password'\)\}\(e\.target\.value\)\}/g, "onChange={(e) => setPassword(e.target.value)}");
fs.writeFileSync('src/pages/auth/Login.jsx', loginCode);

// Fix Register
let regCode = fs.readFileSync('src/pages/auth/Register.jsx', 'utf8');
regCode = regCode.replace(/onClick=\{\(\) => set\{t\('auth\.role'\)\}\(val\)\}/g, "onClick={() => setRole(val)}");
fs.writeFileSync('src/pages/auth/Register.jsx', regCode);

// Fix Dashboard
let empCode = fs.readFileSync('src/pages/employee/Dashboard.jsx', 'utf8');
empCode = empCode.replace(/'\{t\('emp_dash\.not_assigned'\)\}/, "t('emp_dash.not_assigned')");
fs.writeFileSync('src/pages/employee/Dashboard.jsx', empCode);
