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
  const buf = fs.readFileSync(file);
  console.log(`File: ${path.basename(file)} | Size: ${buf.length} bytes`);
  console.log(`  Contains "react-native": ${buf.includes('react-native')}`);
  console.log(`  Contains "HomeScreen": ${buf.includes('HomeScreen')}`);
  console.log(`  Contains "import": ${buf.includes('import')}`);
  console.log(`  Contains "StyleSheet": ${buf.includes('StyleSheet')}`);
  console.log(`  First 20 bytes:`, buf.slice(0, 20));
});
