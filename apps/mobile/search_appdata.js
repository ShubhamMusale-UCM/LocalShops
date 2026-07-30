const fs = require('fs');
const path = require('path');

const appDataDir = 'C:\\Users\\karth\\.gemini\\antigravity';

function walk(dir) {
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'brain' && file !== 'node_modules' && file !== '.git') {
          walk(fullPath);
        }
      } else {
        console.log(`File: ${fullPath} (${stat.size} bytes)`);
      }
    }
  } catch(e) {}
}

walk(appDataDir);
