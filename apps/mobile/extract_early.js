const fs = require('fs');

const logFile = 'C:\\Users\\karth\\.gemini\\antigravity\\brain\\e83bfb61-9adb-4750-bc80-9f088873c1dc\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  const line = lines[40]; // 0-indexed line 41
  
  try {
    const data = JSON.parse(line.trim());
    if (data.tool_calls) {
      data.tool_calls.forEach(call => {
        if (call.args && call.args.CodeContent) {
          const code = call.args.CodeContent;
          fs.writeFileSync('e:/REACT PROJECTS/local_apps_&_services/CityLocalShop/apps/mobile/src/screens/buyer/HomeScreen.tsx.recovered_final', code, 'utf8');
          console.log(`Saved recovered file (${code.length} bytes)`);
        }
      });
    }
  } catch(e) {
    console.error('Error parsing line:', e);
  }
} else {
  console.log('Log file does not exist');
}
