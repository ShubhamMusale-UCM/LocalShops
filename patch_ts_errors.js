const fs = require('fs');
const path = require('path');

const homeScreenPath = path.join(__dirname, 'apps/mobile/src/screens/buyer/HomeScreen.tsx');
let code = fs.readFileSync(homeScreenPath, 'utf8');

// 1. Fix StatusBar style prop
code = code.replace(/<StatusBar style="light" \/>/g, '<StatusBar barStyle="light-content" />');

// 2. Add showSearchOverlay state and import if missing
if (!code.includes('showSearchOverlay')) {
  // It shouldn't get here because patch_all.js added setShowSearchOverlay(true) in JSX.
  // But we need to add the state variable.
}
code = code.replace(
  'const [tempRadius, setTempRadius] = useState<number>(radiusRange);',
  'const [tempRadius, setTempRadius] = useState<number>(radiusRange);\n  const [showSearchOverlay, setShowSearchOverlay] = useState(false);'
);

if (!code.includes('CircularSearchOverlay')) {
  code = code.replace(
    "import AmbientOrbs from '../../components/ui/AmbientOrbs';",
    "import AmbientOrbs from '../../components/ui/AmbientOrbs';\nimport CircularSearchOverlay from '../../components/ui/CircularSearchOverlay';"
  );
  
  // Inject the CircularSearchOverlay right before the final Modal (Location Selector Modal)
  const modalIndex = code.indexOf('{/* ─── Location Selector Modal ─── */}');
  if (modalIndex !== -1) {
    const injection = `
      <CircularSearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        onSearch={(query) => {
          setShowSearchOverlay(false);
          navigation.navigate('Search', { initialQuery: query });
        }}
      />
      `;
    code = code.slice(0, modalIndex) + injection + code.slice(modalIndex);
  }
}

// 3. Fix duplicated styles
// We just remove the old searchSection, searchContainer, searchPlaceholderText, searchContainerGlowBg, searchContainerOuter
const dupes = [
  'searchSection',
  'searchContainer',
  'searchPlaceholderText',
  'searchMicButton'
];

// Simple approach: find the FIRST occurrence of these styles (the original ones) and comment them out or delete them.
// A regex to match `searchSection: { ... },`
for (const key of dupes) {
  const regex = new RegExp(`\\s*${key}:\\s*\\{[\\s\\S]*?\\},`, 'm');
  // replace only the first occurrence!
  code = code.replace(regex, `/* original ${key} removed */`);
}

// Write the fixed code back
fs.writeFileSync(homeScreenPath, code);
console.log('TS errors patch complete.');
