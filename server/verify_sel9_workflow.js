require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const prisma = require('./dist/config/database').default;
const { SupportService } = require('./dist/modules/support/support.service');
const { NetworkService } = require('./dist/modules/network/network.service');

const supportService = new SupportService();
const networkService = new NetworkService();

async function runSel9Verification() {
  console.log('=== Starting SEL-9 (Seller Support Desk & Merchant Network) Verification ===\n');

  // Test Users & Shops
  const testRunId = Date.now().toString().slice(-6);

  console.log('--- Step 1: Setting up Test Entities ---');
  let sellerUser = await prisma.user.create({
    data: {
      phone: `+91981${testRunId}`,
      name: `Seller Tester ${testRunId}`,
      role: 'SELLER',
      referralCode: `SEL${testRunId}`,
    },
  });

  let buyerUser = await prisma.user.create({
    data: {
      phone: `+91971${testRunId}`,
      name: `Buyer Tester ${testRunId}`,
      role: 'BUYER',
      referralCode: `BUY${testRunId}`,
    },
  });

  let adminUser = await prisma.user.create({
    data: {
      phone: `+91991${testRunId}`,
      name: `Admin Tester ${testRunId}`,
      role: 'ADMIN',
      referralCode: `ADM${testRunId}`,
    },
  });

  let shopA = await prisma.shop.create({
    data: {
      name: `Artisan Studio A ${testRunId}`,
      slug: `artisan-studio-a-${testRunId}`,
      description: 'Handcrafted showroom',
      address: 'Lane 5, Koregaon Park, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      latitude: 18.5362,
      longitude: 73.8940,
      phone: `+9198100${testRunId}`,
      ownerId: sellerUser.id,
      category: 'Home & Living',
      operatingHours: {},
    },
  });

  let shopB = await prisma.shop.create({
    data: {
      name: `Craft Guild B ${testRunId}`,
      slug: `craft-guild-b-${testRunId}`,
      description: 'Ceramics showroom',
      address: 'FC Road, Deccan, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411004',
      latitude: 18.5204,
      longitude: 73.8415,
      phone: `+9198200${testRunId}`,
      ownerId: adminUser.id,
      category: 'Ceramics',
      operatingHours: {},
    },
  });

  console.log(`Created Seller: ${sellerUser.name}, Buyer: ${buyerUser.name}, Admin: ${adminUser.name}`);
  console.log(`Created Showroom A: "${shopA.name}", Showroom B: "${shopB.name}"`);

  // --- Step 2: Support Ticket & 4-Hour SLA Verification ---
  console.log('\n--- Step 2: Support Ticket & SLA Verification ---');

  // 2.1 Seller Ticket (4-hour SLA)
  const sellerTicket = await supportService.createTicket(sellerUser.id, {
    subject: 'Urgent: Settlement query for order #992',
    description: 'We need confirmation on counter booking payout.',
    audience: 'SELLER',
    shopId: shopA.id,
  });

  console.log(`Seller Ticket #${sellerTicket.id.slice(0, 8)} created.`);
  console.log(`Audience: ${sellerTicket.audience}, Priority: ${sellerTicket.priority}, Status: ${sellerTicket.status}`);

  if (sellerTicket.audience !== 'SELLER') {
    throw new Error(`Expected audience SELLER, got ${sellerTicket.audience}`);
  }
  if (sellerTicket.priority !== 'HIGH') {
    throw new Error(`Expected priority HIGH for seller ticket, got ${sellerTicket.priority}`);
  }

  const expectedSlaMs = Date.now() + 4 * 3600 * 1000;
  const actualSlaMs = sellerTicket.slaDueAt.getTime();
  const diffHours = (actualSlaMs - Date.now()) / (3600 * 1000);
  console.log(`SLA Due: ${sellerTicket.slaDueAt.toISOString()} (~${diffHours.toFixed(1)} hours from now)`);

  if (Math.abs(diffHours - 4) > 0.1) {
    throw new Error(`Seller SLA not 4 hours: difference is ${diffHours} hours`);
  }
  console.log('Seller 4-Hour Response SLA: PASS');

  // 2.2 Buyer Ticket (24-hour SLA)
  const buyerTicket = await supportService.createTicket(buyerUser.id, {
    subject: 'Question regarding store hold timings',
    description: 'Can I extend hold by 1 hour?',
    audience: 'BUYER',
  });

  const buyerDiffHours = (buyerTicket.slaDueAt.getTime() - Date.now()) / (3600 * 1000);
  console.log(`Buyer SLA Due: ${buyerTicket.slaDueAt.toISOString()} (~${buyerDiffHours.toFixed(1)} hours from now)`);
  if (Math.abs(buyerDiffHours - 24) > 0.1) {
    throw new Error(`Buyer SLA not 24 hours: difference is ${buyerDiffHours} hours`);
  }
  console.log('Buyer 24-Hour Response SLA: PASS');

  // --- Step 3: Ticket Message Thread & Admin Reply ---
  console.log('\n--- Step 3: Message Thread, Status Transitions & Notes ---');

  // Admin replies publicly -> status should transition to IN_PROGRESS
  const reply = await supportService.replyTicket(sellerTicket.id, adminUser.id, 'ADMIN', {
    message: 'Hello! Our merchant desk is reviewing your order payout now.',
  });
  console.log('Admin reply posted:', reply.message);

  const updatedSellerTicket = await supportService.getTicketDetails(sellerTicket.id, sellerUser.id, false);
  console.log('Ticket Status after admin reply:', updatedSellerTicket.status);
  if (updatedSellerTicket.status !== 'IN_PROGRESS') {
    throw new Error(`Expected status IN_PROGRESS after admin reply, got ${updatedSellerTicket.status}`);
  }
  console.log('Status Transition OPEN -> IN_PROGRESS: PASS');

  // Admin logs internal note -> verify hidden from seller view
  await supportService.updateTicketAdmin(sellerTicket.id, adminUser.id, {
    internalNotes: 'Internal verify: Merchant KYC GSTIN verified. Safe to proceed.',
  });

  const sellerView = await supportService.getTicketDetails(sellerTicket.id, sellerUser.id, false);
  const adminView = await supportService.getTicketDetails(sellerTicket.id, adminUser.id, true);

  const sellerSeesInternal = sellerView.messages.some(m => m.isInternal);
  const adminSeesInternal = adminView.messages.some(m => m.isInternal);

  console.log(`Internal note visible to Seller: ${sellerSeesInternal}, visible to Admin: ${adminSeesInternal}`);
  if (sellerSeesInternal || !adminSeesInternal) {
    throw new Error('Internal note privacy violated: seller should not see internal notes');
  }
  console.log('Internal Note Confidentiality: PASS');

  // --- Step 4: Satisfaction Rating on Ticket Close ---
  console.log('\n--- Step 4: Satisfaction Rating on Ticket Close ---');
  const closedTicket = await supportService.rateAndCloseTicket(
    sellerTicket.id,
    sellerUser.id,
    5,
    'Super fast response from merchant team!'
  );

  console.log(`Ticket Status: ${closedTicket.status}, Rating: ${closedTicket.satisfactionRating}★, ClosedAt: ${closedTicket.closedAt}`);
  if (closedTicket.status !== 'CLOSED' || closedTicket.satisfactionRating !== 5) {
    throw new Error('Ticket rating/closure failed');
  }
  console.log('Ticket Satisfaction Rating & Closure: PASS');

  // --- Step 5: Merchant Network & Privacy Enforcement ---
  console.log('\n--- Step 5: Merchant Network Directory & Privacy Enforcement ---');

  // 5.1 Both shops opt into network
  await networkService.updateNetworkProfile(shopA.id, sellerUser.id, {
    networkOptIn: true,
    networkCategory: 'Home & Living',
    networkDescription: 'Handmade furniture & teak woodworking studio.',
  });

  await networkService.updateNetworkProfile(shopB.id, adminUser.id, {
    networkOptIn: true,
    networkCategory: 'Ceramics',
    networkDescription: 'Wheel-thrown artisanal ceramics & stoneware.',
  });

  console.log('Both showrooms opted into Merchant Network.');

  // 5.2 Browse directory from Shop A
  const dirResult = await networkService.getDirectory(shopA.id);
  const foundShopB = dirResult.directory.find(s => s.id === shopB.id);

  if (!foundShopB) {
    throw new Error('Shop B not found in Merchant Network directory');
  }

  console.log(`Found "${foundShopB.name}" in directory. Phone: ${foundShopB.phone}, Connection State: ${foundShopB.connectionState}`);
  if (foundShopB.phone !== null) {
    throw new Error('Privacy breach! Phone number was exposed before mutual connection!');
  }
  if (foundShopB.connectionState !== 'NONE') {
    throw new Error(`Expected connectionState NONE, got ${foundShopB.connectionState}`);
  }
  console.log('Pre-Connection Privacy Protection (Phone Redaction): PASS');

  // 5.3 Send connection request from Shop A to Shop B
  console.log('\n--- Step 6: Mutual Connection Workflow ---');
  const connectReq = await networkService.sendConnectionRequest(
    shopA.id,
    sellerUser.id,
    shopB.id,
    'Hey! We would love to collaborate on cross-display in Koregaon Park.'
  );

  console.log(`Connection request #${connectReq.id} sent with status "${connectReq.status}"`);

  // Verify phone is STILL hidden while PENDING
  const shopAConnectionsPending = await networkService.getShopConnections(shopA.id, sellerUser.id);
  const pendingConn = shopAConnectionsPending.find(c => c.id === connectReq.id);
  if (pendingConn.partner.phone !== null) {
    throw new Error('Privacy breach! Phone exposed while connection is PENDING!');
  }
  console.log('Pending Request Privacy Check: PASS (Phone remains strictly hidden)');

  // 5.4 Shop B accepts the connection request
  const acceptedConn = await networkService.respondToConnection(connectReq.id, adminUser.id, 'ACCEPT');
  console.log(`Connection request updated to status: "${acceptedConn.status}"`);
  if (acceptedConn.status !== 'ACCEPTED') {
    throw new Error(`Expected status ACCEPTED, got ${acceptedConn.status}`);
  }

  // 5.5 Check connections after ACCEPT -> Phone numbers MUST now be revealed!
  const shopAConnectionsAccepted = await networkService.getShopConnections(shopA.id, sellerUser.id);
  const partnerConn = shopAConnectionsAccepted.find(c => c.id === connectReq.id);

  console.log(`Accepted Partner Phone: ${partnerConn.partner.phone}`);
  if (partnerConn.partner.phone !== shopB.phone) {
    throw new Error(`Expected partner phone "${shopB.phone}", got "${partnerConn.partner.phone}"`);
  }
  console.log('Post-Accept Contact Info Unlock: PASS (Direct B2B coordination enabled)');

  // Cleanup test records
  console.log('\n--- Cleanup Test Records ---');
  await prisma.ticketMessage.deleteMany({ where: { ticketId: { in: [sellerTicket.id, buyerTicket.id] } } });
  await prisma.supportTicket.deleteMany({ where: { id: { in: [sellerTicket.id, buyerTicket.id] } } });
  await prisma.merchantConnection.deleteMany({ where: { id: connectReq.id } });
  await prisma.notification.deleteMany({ where: { userId: { in: [sellerUser.id, buyerUser.id, adminUser.id] } } });
  await prisma.shop.deleteMany({ where: { id: { in: [shopA.id, shopB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [sellerUser.id, buyerUser.id, adminUser.id] } } });
  console.log('Cleanup completed cleanly.');

  console.log('\n=== ALL SEL-9 VERIFICATION CHECKS PASSED 100% PERFECTLY! ===');
  process.exit(0);
}

runSel9Verification().catch(err => {
  console.error('SEL-9 Verification Failed:', err);
  process.exit(1);
});
