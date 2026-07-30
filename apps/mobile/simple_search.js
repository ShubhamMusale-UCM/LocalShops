const fs = require('fs');
const path = require('path');

const logFiles = [
  'C:\\Users\\karth\\.gemini\\antigravity\\brain\\e83bfb61-9adb-4750-bc80-9f088873c1dc\\.system_generated\\logs\\overview.txt',
  'C:\\Users\\karth\\.gemini\\antigravity\\brain\\ca98c4f8-06c8-43e7-9b9f-faabb2bcb0a3\\.system_generated\\logs\\overview.txt'
];

logFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`=== Inspecting ${path.basename(path.dirname(path.dirname(file)))} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('HomeScreen.tsx') && line.includes('write_to_file')) {
      console.log(`Line ${idx+1}: len ${line.length}`);
      // Find where CodeContent starts
      const codeStart = line.indexOf('CodeContent');
      if (codeStart !== -1) {
        console.log(`  CodeContent snippet: ${line.substring(codeStart, codeStart + 250)}`);
      }
    }
  });
});
