const fs = require('fs');
let code = fs.readFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', 'utf8');

code = code.replace(/productCardItem: \{[\s\S]*?\},/, `productCardItem: {
      width: 155,
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 24,
      padding: 12,
      marginRight: 16,
      justifyContent: 'space-between',
    },`);

code = code.replace(/shopCardItem: \{[\s\S]*?\},/, `shopCardItem: {
      width: 280,
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 24,
      padding: 16,
      marginRight: 16,
      justifyContent: 'space-between',
    },`);

fs.writeFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', code);
console.log('Cards patched.');
