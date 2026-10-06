const fs = require('fs');

// Fix Login
let loginCode = fs.readFileSync('src/pages/auth/Login.jsx', 'utf8');
loginCode = loginCode.replace(/const \[password, set\{t\('auth\.password'\)\}\] = useState/, "const [password, setPassword] = useState");
fs.writeFileSync('src/pages/auth/Login.jsx', loginCode);

// Fix Register
let regCode = fs.readFileSync('src/pages/auth/Register.jsx', 'utf8');
regCode = regCode.replace(/'\{t\('auth\.password'\)\} must be at least 6 characters'/, "`\${t('auth.password')} must be at least 6 characters`");
regCode = regCode.replace(/'\{t\('auth\.name'\)\} is required'/, "`\${t('auth.name')} is required`");
fs.writeFileSync('src/pages/auth/Register.jsx', regCode);

// Fix LanguageContext
let langCode = fs.readFileSync('src/context/LanguageContext.jsx', 'utf8');
langCode = langCode.replace(/'Today's Attendance'/g, "'Today\\'s Attendance'");
fs.writeFileSync('src/context/LanguageContext.jsx', langCode);

// Fix Dashboard
let empCode = fs.readFileSync('src/pages/employee/Dashboard.jsx', 'utf8');
empCode = empCode.replace(/t\('emp_dash\.not_checked_in'\)'/g, "t('emp_dash.not_checked_in')");
fs.writeFileSync('src/pages/employee/Dashboard.jsx', empCode);
