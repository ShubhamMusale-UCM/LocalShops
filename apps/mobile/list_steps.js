const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\karth\\.gemini\\antigravity\\brain';

try {
  const folders = fs.readdirSync(brainDir);
  folders.forEach(folder => {
    const fullPath = path.join(brainDir, folder);
    if (fs.statSync(fullPath).isDirectory()) {
      const stepsDir = path.join(fullPath, '.system_generated', 'steps');
      if (fs.existsSync(stepsDir)) {
        const stepFolders = fs.readdirSync(stepsDir);
        console.log(`Folder: ${folder} | Steps count: ${stepFolders.length}`);
      } else {
        console.log(`Folder: ${folder} | No steps dir`);
      }
    }
  });
} catch(e) {
  console.error(e);
}
