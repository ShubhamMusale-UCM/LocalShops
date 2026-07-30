const fs = require('fs');
const path = require('path');

const tempDir = 'C:\\Users\\karth\\AppData\\Local\\Temp';
const candidates = [];

function walk(dir, depth = 0) {
  if (depth > 4) return;
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1);
      } else {
        if (fullPath.includes('metro-cache') || file.includes('metro')) {
          // Read content to see if it contains "HomeScreen" or "PremiumHomeScreen"
          // Metro cache files can be large, so only read if reasonably sized
          if (stat.size > 1000 && stat.size < 5000000) {
            try {
              const buf = fs.readFileSync(fullPath);
              if (buf.includes('HomeScreen') && buf.includes('StyleSheet.create')) {
                candidates.push({ path: fullPath, size: stat.size });
              }
            } catch(e) {}
          }
        }
      }
    }
  } catch(e) {}
}

walk(tempDir);

console.log(`Found ${candidates.length} candidate files in metro-cache:`);
candidates.forEach(c => console.log(`${c.path} (${c.size} bytes)`));
