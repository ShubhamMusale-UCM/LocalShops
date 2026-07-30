const fs = require('fs');
const path = require('path');

const conversationFiles = [
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\ca98c4f8-06c8-43e7-9b9f-faabb2bcb0a3.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\fab02800-7ac0-4d06-be03-892ef92b7bc4.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\e83bfb61-9adb-4750-bc80-9f088873c1dc.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\e08346d6-13c4-42d0-8bdf-b111c2eefd76.pb'
];

conversationFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  console.log(`Reading ${file} (${fs.statSync(file).size} bytes)...`);
  const buf = fs.readFileSync(file);
  
  // Convert buffer to string in a safe way
  // Since .pb is binary, some characters might be invalid UTF-8, so we use ascii or utf8 with replacement
  const str = buf.toString('utf8');
  
  // Let's find matches for:
  // "import React" followed by things like "react-native" and "HomeScreen" and ending with Stylesheet.create
  // We can look for the starting pattern
  let pos = 0;
  while (true) {
    const idx = str.indexOf('import React', pos);
    if (idx === -1) break;
    
    // Check if this segment contains HomeScreen or PremiumHomeScreen and StyleSheet.create
    // Let's look up to 80000 characters ahead
    const chunk = str.substring(idx, idx + 80000);
    
    if (chunk.includes('react-native') && 
        (chunk.includes('HomeScreen') || chunk.includes('PremiumHomeScreen')) &&
        chunk.includes('StyleSheet.create') && 
        !chunk.includes('<div') &&
        !chunk.includes('truncated')) {
      
      // We found a match! Let's estimate where it ends.
      // A typical tsx file ends with styles definition. Let's find the last occurrences of closing brackets.
      // Or we can find where another tool call / protobuf structure starts (e.g. non-ascii/control chars or tool names)
      // Usually, there will be some binary bytes or another known string.
      // Let's print out the first 500 characters and write it to a candidate file.
      console.log(`\nFound MATCH in ${path.basename(file)} at offset ${idx}!`);
      
      // Let's find the end of the code by scanning brackets or looking for a boundary
      let bracketCount = 0;
      let endOffset = 0;
      // Let's just find the last index of a closing curly bracket or StyleSheet.create styles
      const stylesheetIndex = chunk.indexOf('StyleSheet.create');
      if (stylesheetIndex !== -1) {
        // Find closing bracket for StyleSheet.create
        // We can search for the last closing brace of the file
        const lastBrace = chunk.lastIndexOf('}');
        if (lastBrace !== -1) {
          endOffset = lastBrace + 1;
        }
      }
      
      if (endOffset === 0) {
        endOffset = 30000; // fallback
      }
      
      const cleanCode = chunk.substring(0, endOffset);
      const outName = `e:/REACT PROJECTS/local_apps_&_services/CityLocalShop/apps/mobile/src/screens/buyer/HomeScreen.tsx.recovered_${path.basename(file, '.pb')}`;
      fs.writeFileSync(outName, cleanCode, 'utf8');
      console.log(`Saved candidate file of length ${cleanCode.length} to: ${outName}`);
      console.log(`Sample start:\n${cleanCode.substring(0, 400)}`);
      console.log('---');
    }
    
    pos = idx + 100;
  }
});
