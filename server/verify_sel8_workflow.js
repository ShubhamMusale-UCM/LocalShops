require('dotenv').config();
const prisma = require('./dist/config/database').default;
const orderService = new (require('./dist/modules/order/order.service').OrderService)();

async function runSel8Verification() {
  console.log('=== Starting SEL-8 (Printing & Dispatch Slip) Verification ===\n');

  // Step 1: Find an existing order or create a test order
  console.log('--- Test 1: Locate Order for Dispatch Slip ---');
  let order = await prisma.order.findFirst({
    include: {
      shop: true,
      user: true,
      items: true,
    },
  });

  if (!order) {
    throw new Error('No order found in database');
  }

  console.log(`Using Order #${order.orderNumber} (ID: ${order.id}) from Shop "${order.shop.name}"`);

  // Step 2: Generate PDF Dispatch Slip
  console.log('\n--- Test 2: Generate PDF Dispatch Slip ---');
  const { pdfBuffer, orderNumber } = await orderService.generateOrderSlip(order.id, order.shop.ownerId);

  console.log(`Generated PDF for Order #${orderNumber}, Buffer length: ${pdfBuffer.length} bytes`);

  // Validate PDF header (%PDF-)
  const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
  console.log('PDF Header Magic Bytes:', pdfHeader);
  if (pdfHeader !== '%PDF-') {
    throw new Error('Generated file does not have valid PDF magic header (%PDF-)');
  }

  // Validate file size (must contain vector layout, fonts, table, and embedded QR code PNG)
  if (pdfBuffer.length < 3000) {
    throw new Error(`PDF size too small (${pdfBuffer.length} bytes). QR code or content may be missing.`);
  }
  console.log('PDF Header & Structure Validation: PASS');

  // Step 3: Authorization Checks
  console.log('\n--- Test 3: Security & Authorization Enforcement ---');
  // 3.1: Random unauthorized user must be rejected
  let unauthorizedBlocked = false;
  try {
    await orderService.generateOrderSlip(order.id, 'unauthorized_stranger_user_id');
  } catch (err) {
    unauthorizedBlocked = true;
    console.log('Unauthorized access correctly blocked with error:', err.message);
  }
  if (!unauthorizedBlocked) {
    throw new Error('Unauthorized user was able to access order dispatch slip');
  }
  console.log('Unauthorized Access Protection: PASS (403 Forbidden)');

  // 3.2: Buyer of the order must be allowed
  if (order.userId && !order.userId.startsWith('anon_')) {
    const buyerSlip = await orderService.generateOrderSlip(order.id, order.userId);
    if (!buyerSlip || !buyerSlip.pdfBuffer) {
      throw new Error('Buyer was unable to access their own dispatch slip');
    }
    console.log('Buyer Authorized Access: PASS');
  }

  console.log('\n=== ALL SEL-8 VERIFICATION CHECKS PASSED PERFECTLY! ===');
  process.exit(0);
}

runSel8Verification().catch(err => {
  console.error('SEL-8 Verification Failed:', err);
  process.exit(1);
});
