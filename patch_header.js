const fs = require('fs');

function run() {
  let code = fs.readFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', 'utf8');

  // Inject AmbientOrbs
  const mainContainerTarget = `<View style={[styles.container, { paddingTop: insets.top, backgroundColor: BRAND.forest }]}>
      <LinearGradient
        colors={[BRAND.forestSoft, BRAND.forest]}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar`;
      
  const mainContainerReplacement = `<View style={[styles.container, { paddingTop: insets.top, backgroundColor: BRAND.forest }]}>
      <LinearGradient
        colors={[BRAND.forestSoft, BRAND.forest]}
        style={StyleSheet.absoluteFillObject}
      />
      <AmbientOrbs />
      <StatusBar`;
  
  if(code.includes(mainContainerTarget)) {
      code = code.replace(mainContainerTarget, mainContainerReplacement);
  } else {
      console.log('Failed to find mainContainerTarget');
  }

  // Rewrite Header
  const headerStartTarget = `<Animated.View style={[styles.header, headerAnimatedStyle]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity`;
        
  // Finding where the header ends... it ends at `</Animated.View>` right before `<Animated.ScrollView`
  const headerFullRegex = /<Animated\.View style=\{\[styles\.header, headerAnimatedStyle\]\}>[\s\S]*?<\/Animated\.View>/;
  
  const headerReplacement = `<Animated.View style={[styles.header, headerAnimatedStyle, { zIndex: 40 }]}>
        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFillObject, { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Profile')} style={{ position: 'relative' }}>
            <Image source={IMAGES.avatar} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, backgroundColor: '#22C55E', borderRadius: 6, borderWidth: 2, borderColor: BRAND.forest }} />
          </TouchableOpacity>
          <View style={{ justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Welcome back</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFF' }}>{user?.name ? user.name.split(' ')[0] : 'Guest'}</Text>
          </View>
          <View style={{ flex: 1 }} />
          
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.glassButtonIcon}>
              <Ionicons name="moon-outline" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassButtonIcon} onPress={() => Alert.alert('Notifications', 'No new notifications right now!')}>
              <Ionicons name="notifications-outline" size={18} color="#FFF" />
              <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4, borderWidth: 1, borderColor: BRAND.forestSoft }} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>`;

  if(headerFullRegex.test(code)) {
      code = code.replace(headerFullRegex, headerReplacement);
  } else {
      console.log('Failed to find header regex');
  }
  
  // Add glassButtonIcon to getStyles
  const styleInjection = `glassButtonIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    container:`;
  code = code.replace('container:', styleInjection);

  fs.writeFileSync('apps/mobile/src/screens/buyer/HomeScreen.tsx', code);
  console.log('Patch complete.');
}

run();
