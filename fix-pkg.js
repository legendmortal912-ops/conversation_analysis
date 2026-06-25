const fs = require('fs');
const path = require('path');

const appsDir = path.join(process.cwd(), 'apps');
const apps = fs.readdirSync(appsDir);

apps.forEach(app => {
  if (app === 'dashboard-frontend' || app === 'analysis-engine') return;
  const pkgPath = path.join(appsDir, app, 'package.json');
  if (fs.existsSync(pkgPath)) {
    let content = fs.readFileSync(pkgPath, 'utf8');
    
    // The previous powershell replace replaced it with literally `r`n
    content = content.replace('"dependencies": {`r`n    "@prisma/client": "^6.19.0",', '"dependencies": {\n    "@prisma/client": "^6.19.0",');
    content = content.replace('"dependencies": {`n    "@prisma/client": "^6.19.0",', '"dependencies": {\n    "@prisma/client": "^6.19.0",');
    
    fs.writeFileSync(pkgPath, content);
  }
});
console.log('Done!');
