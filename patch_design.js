const fs = require('fs');

function run() {
  let code = fs.readFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', 'utf8');

  // Fix scrollHandler
  const hookTarget = `const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });`;
  const hookReplacement = `const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      if (tabOnScroll) runOnJS(tabOnScroll)(event);
    },
  });`;
  code = code.replace(hookTarget, hookReplacement);

  const importTarget = `import Animated, {`;
  const importReplacement = `import { BlurView } from 'expo-blur';\nimport Animated, { runOnJS, `;
  code = code.replace(importTarget, importReplacement);

  const svOnScrollTarget = `onScroll={(e) => { tabOnScroll(e); scrollHandler(e); }}`;
  const svOnScrollReplacement = `onScroll={scrollHandler}`;
  code = code.replace(svOnScrollTarget, svOnScrollReplacement);

  const brandTarget = `const BRAND = {
  forest: '#000000',
  forestSoft: '#111111',
  mint: '#000000',
  mintCard: '#111111',
  citrus: '#FFFFFF',
  citrusDeep: '#E0E0E0',
  lime: '#333333',
  ink: '#FFFFFF',
  inkSoft: '#A0A0A0',
  gold: '#F2A93B',
};`;
  const brandReplacement = `const BRAND = {
  forest: '#0B1020',
  forestSoft: '#151A2D',
  mint: '#0B1020',
  mintCard: '#151A2D',
  citrus: '#2563EB',
  citrusDeep: '#1D4ED8',
  lime: '#06B6D4',
  ink: '#FFFFFF',
  inkSoft: '#94A3B8',
  gold: '#F59E0B',
};`;
  code = code.replace(brandTarget, brandReplacement);

  // Upgrade styling values
  code = code.replace(/borderRadius: 16/g, 'borderRadius: 24');
  code = code.replace(/borderRadius: 12/g, 'borderRadius: 20');
  code = code.replace(/borderRadius: 8/g, 'borderRadius: 16');
  code = code.replace(/elevation: \d/g, 'elevation: 10');
  code = code.replace(/shadowOpacity: 0\.\d+/g, 'shadowOpacity: 0.3');
  code = code.replace(/shadowRadius: \d+/g, 'shadowRadius: 15');
  code = code.replace(/paddingHorizontal: 16/g, 'paddingHorizontal: 24');
  code = code.replace(/padding: 16/g, 'padding: 24');

  // Change Header background to translucent
  const headerStyleTarget = `backgroundColor: interpolateColor(scrollY.value, [0, 50], ['rgba(0,0,0,1)', 'rgba(0,0,0,0.85)']),`;
  const headerStyleReplacement = `backgroundColor: interpolateColor(scrollY.value, [0, 50], ['rgba(11, 16, 32, 0.8)', 'rgba(11, 16, 32, 0.95)']),`;
  code = code.replace(headerStyleTarget, headerStyleReplacement);

  fs.writeFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', code);
  console.log('Patch complete.');
}

run();
