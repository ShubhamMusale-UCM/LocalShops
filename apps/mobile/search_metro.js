const fs = require('fs');
const path = require('path');

const searchDirs = [
  'C:\\Users\\karth\\AppData\\Local\\Temp',
  'C:\\Users\\karth\\AppData\\Local\\metro-cache',
  'C:\\Users\\karth\\AppData\\Local\\Metro',
  'e:\\REACT PROJECTS\\local_apps_&_services\\CityLocalShop\\apps\\mobile\\.expo'
];

searchDirs.forEach(baseDir => {
  if (!fs.existsSync(baseDir)) return;
  console.log(`Searching ${baseDir}...`);
  try {
    const files = fs.readdirSync(baseDir);
    files.forEach(f => {
      const p = path.join(baseDir, f);
      try {
        const stat = fs.statSync(p);
        if (stat.isFile() && (f.includes('metro') || stat.size > 10000)) {
          // Check if file contains "HomeScreen" or "PremiumHomeScreen"
          const buf = fs.readFileSync(p);
          if (buf.includes('HomeScreen') || buf.includes('PremiumHomeScreen')) {
            console.log(`Found candidate in Temp: ${p} (${stat.size} bytes)`);
          }
        }
      } catch(e) {}
    });
  } catch(e) {}
});
