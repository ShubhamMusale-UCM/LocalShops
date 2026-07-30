const fs = require('fs');
const readline = require('readline');

const jsonlFile = 'C:\\Users\\karth\\.gemini\\antigravity\\brain\\e83bfb61-9adb-4750-bc80-9f088873c1dc\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(jsonlFile)) {
  const fileStream = fs.createReadStream(jsonlFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNum = 0;
  rl.on('line', (line) => {
    lineNum++;
    if (line.includes('HomeScreen.tsx') && line.includes('CodeContent')) {
      console.log(`Line ${lineNum}: len ${line.length}`);
      if (!line.includes('truncated')) {
        console.log(`  Found non-truncated line in jsonl at line ${lineNum}!`);
      }
    }
  });
  
  rl.on('close', () => {
    console.log('Finished reading jsonl.');
  });
} else {
  console.log('jsonl does not exist');
}
