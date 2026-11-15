const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const SERVER_ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(SERVER_ROOT, '.env') });
const FRONTEND_ROOT = path.resolve(__dirname, '../../../temp_github_repo');
const DOCS_ROOT = path.resolve(__dirname, '../../../docs/audit');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('       RELEASE BLOCKERS AUDIT VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Android Release Configuration (RB-3 & RB-4)
  console.log('--- 1. Testing Android Release Configuration (RB-3 & RB-4) ---');
  const capConfigPath = path.join(FRONTEND_ROOT, 'capacitor.config.ts');
  const capConfigContent = fs.readFileSync(capConfigPath, 'utf8');
  assert(capConfigContent.includes("appId: 'in.citylocalshop.app'"), 'Capacitor appId set to in.citylocalshop.app');
  assert(capConfigContent.includes("appName: 'CityLocalShop'"), 'Capacitor appName set to CityLocalShop');
  assert(!capConfigContent.includes('192.168.1.34'), 'No hardcoded LAN IP in capacitor config');
  assert(capConfigContent.includes('allowMixedContent: false'), 'Mixed content disabled in Android config');

  const buildGradlePath = path.join(FRONTEND_ROOT, 'android/app/build.gradle');
  const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
  assert(buildGradleContent.includes("applicationId \"in.citylocalshop.app\""), 'build.gradle applicationId is in.citylocalshop.app');
  assert(buildGradleContent.includes("namespace \"in.citylocalshop.app\""), 'build.gradle namespace is in.citylocalshop.app');

  const netSecPath = path.join(FRONTEND_ROOT, 'android/app/src/main/res/xml/network_security_config.xml');
  assert(fs.existsSync(netSecPath), 'network_security_config.xml exists');
  const netSecContent = fs.readFileSync(netSecPath, 'utf8');
  assert(netSecContent.includes('cleartextTrafficPermitted="false"'), 'Cleartext HTTP forbidden in production base-config');

  const manifestPath = path.join(FRONTEND_ROOT, 'android/app/src/main/AndroidManifest.xml');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  assert(manifestContent.includes('android:allowBackup="false"'), 'android:allowBackup set to false in Manifest');
  assert(!manifestContent.includes('android:usesCleartextTraffic="true"'), 'usesCleartextTraffic removed from Manifest');
  assert(manifestContent.includes('ACCESS_FINE_LOCATION'), 'ACCESS_FINE_LOCATION declared in Manifest');
  assert(manifestContent.includes('POST_NOTIFICATIONS'), 'POST_NOTIFICATIONS declared in Manifest');

  // 2. Deferred Registry Audit Check
  console.log('\n--- 2. Testing Living Deferred Registry (FINAL_STAGE_DEFERRED.md) ---');
  const deferredDocPath = path.join(DOCS_ROOT, 'FINAL_STAGE_DEFERRED.md');
  assert(fs.existsSync(deferredDocPath), 'FINAL_STAGE_DEFERRED.md exists in docs/audit');
  const deferredContent = fs.readFileSync(deferredDocPath, 'utf8');
  assert(deferredContent.includes('RB-5') && deferredContent.includes('DLT SMS'), 'RB-5 (DLT SMS) documented in deferred registry');
  assert(deferredContent.includes('RB-8') && deferredContent.includes('Razorpay Live Keys'), 'RB-8 (Razorpay Live Keys & Split) documented in deferred registry');

  // 3. Backend Account Deletion & Data Export APIs (RB-6)
  console.log('\n--- 3. Testing Account Deletion & Data Export API (RB-6) ---');
  const prismaClientPkg = fs.existsSync(path.join(SERVER_ROOT, 'node_modules/@prisma/client'))
    ? path.join(SERVER_ROOT, 'node_modules/@prisma/client')
    : path.join(SERVER_ROOT, '../node_modules/@prisma/client');
  const { PrismaClient } = require(prismaClientPkg);
  const prisma = new PrismaClient();

  // Find or create test buyer user
  let testUser = await prisma.user.findFirst({ where: { phone: '+919999900001' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        phone: '+919999900001',
        name: 'Release Blocker Test Buyer',
        role: 'BUYER',
        referralCode: 'RBTEST01',
      },
    });
  }

  // Generate test JWT
  const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-chars-long';
  const token = jwt.sign(
    { id: testUser.id, role: testUser.role, phone: testUser.phone },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // Test GET /api/users/export
  try {
    const exportRes = await fetch(`${BASE_URL}/users/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const exportData = await exportRes.json();
    assert(exportRes.status === 200, `GET /api/users/export returned 200 (Got ${exportRes.status})`);
    assert(exportData.status === 'success' && exportData.data?.profile?.id === testUser.id, 'Export data contains user profile');
    assert(exportData.data?.exportMetadata?.legalNotice?.includes('DPDP'), 'Export metadata includes DPDP compliance notice');
    assert(Array.isArray(exportData.data?.orderHistory), 'Export data contains orderHistory array');
  } catch (err) {
    assert(false, `GET /api/users/export threw error: ${err.message}`);
  }

  // Test POST /api/users/delete-request
  try {
    const delRes = await fetch(`${BASE_URL}/users/delete-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const delData = await delRes.json();
    assert(delRes.status === 200, `POST /api/users/delete-request returned 200 (Got ${delRes.status})`);
    assert(delData.status === 'PENDING_DELETION' || delData.status === 'success', 'Deletion response confirms PENDING_DELETION state');
    assert(delData.gracePeriodDays === 14, '14-day grace period confirmed in response');

    // Verify DB updated
    const dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(dbUser.deletionStatus === 'PENDING_DELETION', 'User record updated to PENDING_DELETION in DB');
    assert(Boolean(dbUser.deletionRequestedAt), 'deletionRequestedAt timestamp populated in DB');
  } catch (err) {
    assert(false, `POST /api/users/delete-request threw error: ${err.message}`);
  }

  // Test POST /api/users/cancel-deletion
  try {
    const cancelRes = await fetch(`${BASE_URL}/users/cancel-deletion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, `POST /api/users/cancel-deletion returned 200 (Got ${cancelRes.status})`);
    assert(cancelData.deletionStatus === 'ACTIVE', 'Cancellation restores ACTIVE status');

    const dbUserRestored = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(dbUserRestored.deletionStatus === null, 'deletionStatus cleared to null in DB');
    assert(dbUserRestored.deletionRequestedAt === null, 'deletionRequestedAt cleared to null in DB');
  } catch (err) {
    assert(false, `POST /api/users/cancel-deletion threw error: ${err.message}`);
  }

  // Verify Audit Log records were generated
  const auditLogs = await prisma.$queryRawUnsafe(`
    SELECT action, entity_id, entity_type FROM audit_logs 
    WHERE entity_id = $1 
    ORDER BY created_at DESC 
    LIMIT 5
  `, testUser.id);
  const actions = auditLogs.map(l => l.action);
  assert(actions.includes('ACCOUNT_DELETION_REQUESTED'), 'Audit log recorded ACCOUNT_DELETION_REQUESTED');
  assert(actions.includes('ACCOUNT_DELETION_CANCELLED'), 'Audit log recorded ACCOUNT_DELETION_CANCELLED');

  // 4. Frontend Legal Pages & Build Artifacts (RB-7)
  console.log('\n--- 4. Testing Legal Screens & Distribution Bundles (RB-7) ---');
  const legalFiles = [
    'PrivacyPolicyScreen.tsx',
    'TermsOfServiceScreen.tsx',
    'RefundPolicyScreen.tsx',
    'GrievanceRedressalScreen.tsx',
    'AccountDeletionScreen.tsx',
  ];
  for (const f of legalFiles) {
    const p = path.join(FRONTEND_ROOT, 'src/screens/legal', f);
    assert(fs.existsSync(p), `Legal screen exists: ${f}`);
  }

  // Check Vite dist assets
  const distAssetsDir = path.join(FRONTEND_ROOT, 'dist/assets');
  const distFiles = fs.readdirSync(distAssetsDir);
  assert(distFiles.some(f => f.startsWith('PrivacyPolicyScreen-')), 'Vite built PrivacyPolicyScreen chunk');
  assert(distFiles.some(f => f.startsWith('TermsOfServiceScreen-')), 'Vite built TermsOfServiceScreen chunk');
  assert(distFiles.some(f => f.startsWith('RefundPolicyScreen-')), 'Vite built RefundPolicyScreen chunk');
  assert(distFiles.some(f => f.startsWith('GrievanceRedressalScreen-')), 'Vite built GrievanceRedressalScreen chunk');
  assert(distFiles.some(f => f.startsWith('AccountDeletionScreen-')), 'Vite built AccountDeletionScreen chunk');

  // Check Capacitor Android assets
  const capAndroidAssets = path.join(FRONTEND_ROOT, 'android/app/src/main/assets/public');
  assert(fs.existsSync(capAndroidAssets), 'Capacitor Android public assets directory exists');
  assert(fs.existsSync(path.join(capAndroidAssets, 'index.html')), 'Capacitor public/index.html synced');

  await prisma.$disconnect();

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
