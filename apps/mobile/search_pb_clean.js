const fs = require('fs');
const path = require('path');

const conversationFiles = [
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\ca98c4f8-06c8-43e7-9b9f-faabb2bcb0a3.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\fab02800-7ac0-4d06-be03-892ef92b7bc4.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\e83bfb61-9adb-4750-bc80-9f088873c1dc.pb',
  'C:\\Users\\karth\\.gemini\\antigravity\\conversations\\e08346d6-13c4-42d0-8bdf-b111c2eefd76.pb'
];

conversationFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  console.log(`Scanning ${path.basename(file)}...`);
  const buf = fs.readFileSync(file);
  const str = buf.toString('utf8');
  
  let pos = 0;
  let matchCount = 0;
  
  while (true) {
    const idx = str.indexOf('import React', pos);
    if (idx === -1) break;
    
    pos = idx + 12; // Advance position for next search
    
    // Look ahead 100,000 characters
    const chunk = str.substring(idx, idx + 100000);
    
    // Check if this chunk is a react-native HomeScreen file
    if (chunk.includes('react-native') && 
        (chunk.includes('HomeScreen') || chunk.includes('PremiumHomeScreen')) && 
        chunk.includes('StyleSheet.create')) {
      
      // Let's find where the code actually ends.
      // Usually, it's inside a JSON string or protobuf string, so it will end at a double quote or when binary bytes start.
      // Let's scan character by character to find the end of the text string.
      let endIdx = 0;
      for (let i = 0; i < chunk.length; i++) {
        const charCode = chunk.charCodeAt(i);
        // Look for typical ending signs or binary characters
        // Protobuf binary data or control characters (except tab, LF, CR)
        if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
          endIdx = i;
          break;
        }
      }
      
      if (endIdx === 0) {
        endIdx = chunk.length;
      }
      
      const code = chunk.substring(0, endIdx);
      
      // Verify this specific code block doesn't contain HTML tags like <div> or <style>
      // if it has <View> and StyleSheet.create, it's our React Native screen!
      if (code.includes('<View') && !code.includes('<div') && !code.includes('className=')) {
        matchCount++;
        const outName = `e:/REACT PROJECTS/local_apps_&_services/CityLocalShop/apps/mobile/src/screens/buyer/HomeScreen.tsx.recovered_${path.basename(file, '.pb')}_${matchCount}.tsx`;
        
        // Clean up escaped newlines if it was stored inside a JSON string
        let cleanCode = code;
        if (code.includes('\\n') || code.includes('\\"')) {
          // It's escaped! Let's unescape it.
          // We can do it safely by wrapping it in JSON.parse if it's a valid JSON string,
          // or manually replacing \\n with \n and \\" with "
          cleanCode = code
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
        
        fs.writeFileSync(outName, cleanCode, 'utf8');
        console.log(`  -> Found React Native code block! Saved (${cleanCode.length} bytes) to ${path.basename(outName)}`);
      }
    }
  }
});
