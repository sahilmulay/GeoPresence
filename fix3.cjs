const fs = require('fs');

let capCode = fs.readFileSync('src/components/AttendanceCapture.jsx', 'utf8');
capCode = capCode.replace(/'\{t\('cap\.loc_ready'\)\}'/g, "t('cap.loc_ready')");
capCode = capCode.replace(/'\{t\('cap\.loc_loading'\)\}'/g, "t('cap.loc_loading')");
capCode = capCode.replace(/'\{t\('cap\.loc_error'\)\}'/g, "t('cap.loc_error')");
fs.writeFileSync('src/components/AttendanceCapture.jsx', capCode);
