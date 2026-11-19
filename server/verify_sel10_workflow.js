require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const prisma = require('./dist/config/database').default;
const { ShopMemberService } = require('./dist/modules/shop/shopMember.service');
const orderService = new (require('./dist/modules/order/order.service').OrderService)();
const { deductOrderStockTx } = require('./dist/modules/order/order.service');

const shopMemberService = new ShopMemberService();

async function runSel10Verification() {
  console.log('=== Starting SEL-10 (Seller Operations Backlog) Verification ===\n');

  const testRunId = Date.now().toString().slice(-6);

  console.log('--- Step 1: Create Test Shop & Owner ---');
  const ownerUser = await prisma.user.create({
    data: {
      phone: `+91992${testRunId}`,
      name: `Owner Test ${testRunId}`,
      role: 'SELLER',
      referralCode: `OWN${testRunId}`,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      phone: `+91993${testRunId}`,
      name: `Counter Staff ${testRunId}`,
      role: 'SELLER',
      referralCode: `STF${testRunId}`,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      phone: `+91994${testRunId}`,
      name: `Store Manager ${testRunId}`,
      role: 'SELLER',
      referralCode: `MGR${testRunId}`,
    },
  });

  const shop = await prisma.shop.create({
    data: {
      name: `Operations Showroom ${testRunId}`,
      slug: `ops-showroom-${testRunId}`,
      description: 'Operations test showroom',
      address: 'Law College Road, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411004',
      latitude: 18.5158,
      longitude: 73.8312,
      phone: `+9199200${testRunId}`,
      ownerId: ownerUser.id,
      category: 'Home & Living',
      gstNumber: '27AABCU9603R1ZM',
      operatingHours: {},
    },
  });

  console.log(`Created Showroom: "${shop.name}" (ID: ${shop.id}) with Owner "${ownerUser.name}"`);

  // --- Step 2: Multi-Staff Roles & Permission Matrix ---
  console.log('\n--- Step 2: Multi-Staff Roles & Permission Matrix ---');

  // 2.1 Invite Counter Member
  const counterMember = await shopMemberService.inviteMember(shop.id, ownerUser.id, {
    phone: staffUser.phone,
    name: 'Ravi Cashier',
    role: 'COUNTER',
  });
  console.log(`Counter staff invited: role=${counterMember.role}, phone=${counterMember.phone}, joined=${Boolean(counterMember.joinedAt)}`);
  if (counterMember.role !== 'COUNTER') {
    throw new Error(`Expected role COUNTER, got ${counterMember.role}`);
  }

  // 2.2 Invite Manager Member
  const managerMember = await shopMemberService.inviteMember(shop.id, ownerUser.id, {
    phone: managerUser.phone,
    name: 'Anita Manager',
    role: 'MANAGER',
  });
  console.log(`Manager staff invited: role=${managerMember.role}, phone=${managerMember.phone}`);
  if (managerMember.role !== 'MANAGER') {
    throw new Error(`Expected role MANAGER, got ${managerMember.role}`);
  }

  // 2.3 Verify Roster Output
  const roster = await shopMemberService.getMembers(shop.id, ownerUser.id);
  console.log(`Showroom Roster: Owner=${roster.owner.name}, Total Staff Members=${roster.members.length}`);
  if (roster.members.length !== 2) {
    throw new Error(`Expected 2 staff members, got ${roster.members.length}`);
  }

  // 2.4 Verify Permissions Matrix
  const counterCanHandleOrders = await shopMemberService.hasPermission(shop.id, staffUser.id, 'COUNTER');
  const counterCanAccessManagerOps = await shopMemberService.hasPermission(shop.id, staffUser.id, 'MANAGER');
  const managerCanAccessCounterOps = await shopMemberService.hasPermission(shop.id, managerUser.id, 'COUNTER');
  const managerCanAccessManagerOps = await shopMemberService.hasPermission(shop.id, managerUser.id, 'MANAGER');
  const ownerCanAccessAll = await shopMemberService.hasPermission(shop.id, ownerUser.id, 'OWNER');

  console.log(`Permission Matrix Checks:
  - Counter user can handle Counter orders: ${counterCanHandleOrders} (Expect: true)
  - Counter user can access Manager ops: ${counterCanAccessManagerOps} (Expect: false)
  - Manager user can handle Counter orders: ${managerCanAccessCounterOps} (Expect: true)
  - Manager user can access Manager ops: ${managerCanAccessManagerOps} (Expect: true)
  - Owner satisfies all permissions: ${ownerCanAccessAll} (Expect: true)`);

  if (!counterCanHandleOrders || counterCanAccessManagerOps || !managerCanAccessCounterOps || !managerCanAccessManagerOps || !ownerCanAccessAll) {
    throw new Error('Permissions hierarchy check failed!');
  }
  console.log('Multi-Staff Permissions Matrix: PASS');

  // --- Step 3: Low-Stock Real-Time Alert Trigger ---
  console.log('\n--- Step 3: Low-Stock Alert Trigger ---');
  const testProduct = await prisma.product.create({
    data: {
      shopId: shop.id,
      name: `Artisan Brass Pitcher ${testRunId}`,
      description: 'Handcrafted solid brass water pitcher',
      price: 1800,
      quantity: 6,
      lowStockThreshold: 4,
      category: 'Home & Living',
      images: ['https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&q=80&w=800'],
    },
  });

  console.log(`Created product "${testProduct.name}" with Initial Stock=${testProduct.quantity}, LowStockThreshold=${testProduct.lowStockThreshold}`);

  // Deduct 3 units in transaction: Stock drops from 6 to 3 (<= threshold 4)
  await prisma.$transaction(async (tx) => {
    await deductOrderStockTx(tx, [{ productId: testProduct.id, quantity: 3 }]);
  });

  const updatedProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
  console.log(`Updated Stock after deduction: ${updatedProduct.quantity} (Threshold is ${updatedProduct.lowStockThreshold})`);
  if (updatedProduct.quantity !== 3) {
    throw new Error(`Expected stock 3, got ${updatedProduct.quantity}`);
  }

  // Verify notification created for owner
  const lowStockNotification = await prisma.notification.findFirst({
    where: {
      userId: ownerUser.id,
      title: { contains: 'Low Stock Alert' },
    },
  });

  if (!lowStockNotification) {
    throw new Error('Low stock alert notification was not dispatched to shop owner!');
  }
  console.log(`Low Stock Notification dispatched: "${lowStockNotification.title}" - ${lowStockNotification.body}`);
  console.log('Low-Stock Real-Time Alert Engine: PASS');

  // --- Step 4: Archived Orders & Restore Workflow ---
  console.log('\n--- Step 4: Archived Orders & Restore Workflow ---');

  // Create test order
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-SEL10-${testRunId}`,
      shopId: shop.id,
      userId: staffUser.id,
      status: 'CANCELLED',
      sellerNote: 'Buyer did not visit within hold window',
      total: 1800,
      subtotal: 1800,
      bookingAmount: 200,
      balanceAmount: 1600,
      paymentMethod: 'COUNTER',
      items: {
        create: {
          productId: testProduct.id,
          quantity: 1,
          price: 1800,
          total: 1800,
        },
      },
    },
  });

  console.log(`Created Cancelled Order #${order.orderNumber} (ID: ${order.id})`);

  // Archive order
  await orderService.archiveShopOrder(shop.id, ownerUser.id, order.id);
  const archivedList = await orderService.getArchivedOrders(shop.id, ownerUser.id);
  console.log(`Archived Orders Count: ${archivedList.length}`);
  const foundArchived = archivedList.find(o => o.id === order.id);
  if (!foundArchived) {
    throw new Error('Order not found in archived orders list after archiving');
  }
  console.log('Order Archival: PASS');

  // Restore order
  await orderService.restoreShopOrder(shop.id, ownerUser.id, order.id);
  const restoredList = await orderService.getArchivedOrders(shop.id, ownerUser.id);
  const foundRestored = restoredList.find(o => o.id === order.id);
  if (foundRestored) {
    throw new Error('Order still found in archived orders list after restoring');
  }
  console.log('Order Restoration from Archive: PASS');

  // --- Step 5: Accounting Orders CSV Export ---
  console.log('\n--- Step 5: Accounting Orders CSV Export ---');
  const csvData = await orderService.exportOrdersCsv(shop.id, ownerUser.id);
  console.log('Generated Accounting CSV Output preview:\n', csvData.split('\n').slice(0, 3).join('\n'));

  if (!csvData.startsWith('OrderNumber,Date,CustomerName,CustomerPhone,ItemsCount,ItemNames,Subtotal,Discount,TokenPaid,BalanceCollected,Total,PaymentMethod,Status,GSTIN')) {
    throw new Error('CSV header missing accounting tax columns!');
  }
  if (!csvData.includes(`"ORD-SEL10-${testRunId}"`)) {
    throw new Error('Exported CSV does not contain the shop order record');
  }
  console.log('Accounting Orders CSV Export: PASS');

  // Cleanup test records
  console.log('\n--- Cleanup Test Records ---');
  await prisma.notification.deleteMany({ where: { userId: { in: [ownerUser.id, staffUser.id, managerUser.id] } } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.deleteMany({ where: { id: order.id } });
  await prisma.product.deleteMany({ where: { id: testProduct.id } });
  await prisma.shopMember.deleteMany({ where: { shopId: shop.id } });
  await prisma.shop.deleteMany({ where: { id: shop.id } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerUser.id, staffUser.id, managerUser.id] } } });
  console.log('Cleanup completed cleanly.');

  console.log('\n=== ALL SEL-10 VERIFICATION CHECKS PASSED 100% PERFECTLY! ===');
  process.exit(0);
}

runSel10Verification().catch(err => {
  console.error('SEL-10 Verification Failed:', err);
  process.exit(1);
});
