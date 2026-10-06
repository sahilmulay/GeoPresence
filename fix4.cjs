const fs = require('fs');

let capCode = fs.readFileSync('src/components/AttendanceCapture.jsx', 'utf8');
capCode = capCode.replace(/'\{t\('cap\.open_cam'\)\}'/g, "t('cap.open_cam')");
capCode = capCode.replace(/'\{t\('cap\.use_app'\)\}'/g, "t('cap.use_app')");
fs.writeFileSync('src/components/AttendanceCapture.jsx', capCode);
