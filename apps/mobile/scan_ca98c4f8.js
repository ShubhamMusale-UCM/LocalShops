const fs = require('fs');

const logFile = 'C:\\Users\\karth\\.gemini\\antigravity\\brain\\ca98c4f8-06c8-43e7-9b9f-faabb2bcb0a3\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('HomeScreen.tsx')) {
      console.log(`Line ${idx+1}: len ${line.length}`);
      if (line.includes('write_to_file') || line.includes('replace_file_content')) {
        console.log(`  Type: Write/Edit`);
      }
    }
  });
} else {
  console.log('Log file does not exist');
}
