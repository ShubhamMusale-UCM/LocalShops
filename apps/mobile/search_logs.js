const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\karth\\.gemini\\antigravity\\brain';
const results = [];

function walk(dir) {
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.txt') || file.endsWith('.jsonl')) {
        if (stat.size > 20000000) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Let's find index of "StyleSheet.create"
        let pos = 0;
        while (true) {
          const idx = content.indexOf('StyleSheet.create', pos);
          if (idx === -1) break;
          
          // Let's grab a candidate block around it:
          // start from 30000 chars before, up to 10000 chars after
          const startSearch = Math.max(0, idx - 30000);
          const endSearch = Math.min(content.length, idx + 10000);
          
          const text = content.substring(startSearch, endSearch);
          
          // Look for "import React" in this chunk
          const reactIdx = text.indexOf('import React');
          if (reactIdx !== -1) {
            const codeBlock = text.substring(reactIdx);
            
            // Check if this block seems like a HomeScreen React Native code
            if (codeBlock.toLowerCase().includes('homescreen') && 
                codeBlock.includes('react-native') && 
                !codeBlock.includes('<div') && 
                !codeBlock.includes('truncated')) {
              results.push({
                file: fullPath,
                size: codeBlock.length,
                code: codeBlock
              });
            }
          }
          pos = idx + 20;
        }
      }
    }
  } catch(e) {
    console.error('Error walking', dir, e);
  }
}

walk(brainDir);

console.log(`Found ${results.length} flexible candidates.`);
results.sort((a, b) => b.size - a.size);

if (results.length > 0) {
  const best = results[0];
  console.log(`Best candidate from: ${best.file}`);
  console.log(`Code size: ${best.size} bytes`);
  console.log('Sample start:\n', best.code.substring(0, 500));
  fs.writeFileSync('e:/REACT PROJECTS/local_apps_&_services/CityLocalShop/apps/mobile/src/screens/buyer/HomeScreen.tsx.recovered_final', best.code, 'utf8');
  console.log('Saved best candidate to HomeScreen.tsx.recovered_final');
} else {
  console.log('No flexible candidates found.');
}
