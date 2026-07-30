import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function clearExistingData() {
  // Delete in FK-safe order.
  await prisma.orderItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promotedListing.deleteMany();
  await prisma.shopStory.deleteMany();
  await prisma.shopAnalytics.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.savedShop.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.referralEarning.deleteMany();
  await prisma.product.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Seeding minimal dataset: Milk + Tree and owners');

  await clearExistingData();

  const milkOwner = await prisma.user.create({
    data: {
      phone: '9000000001',
      name: 'Milk Owner',
      email: 'milk.owner@citypulse.local',
      role: 'SELLER',
      referralCode: `CLS${nanoid(6).toUpperCase()}`,
      isVerified: true,
      city: 'Bengaluru',
      latitude: 12.977,
      longitude: 77.603,
    },
  });

  const treeOwner = await prisma.user.create({
    data: {
      phone: '9000000002',
      name: 'Tree Owner',
      email: 'tree.owner@citypulse.local',
      role: 'SELLER',
      referralCode: `CLS${nanoid(6).toUpperCase()}`,
      isVerified: true,
      city: 'Bengaluru',
      latitude: 12.966,
      longitude: 77.611,
    },
  });

  const milkShop = await prisma.shop.create({
    data: {
      ownerId: milkOwner.id,
      name: 'Milk Corner',
      slug: 'milk-corner-blr',
      description: 'Fresh milk and dairy essentials for nearby families.',
      phone: '9000000001',
      whatsapp: '9000000001',
      address: '12, Residency Road',
      landmark: 'Near Central Park',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.977,
      longitude: 77.603,
      category: 'grocery',
      subCategories: ['Dairy'],
      isActive: true,
      operatingHours: {
        monday: { open: '06:00', close: '22:00' },
        tuesday: { open: '06:00', close: '22:00' },
        wednesday: { open: '06:00', close: '22:00' },
        thursday: { open: '06:00', close: '22:00' },
        friday: { open: '06:00', close: '22:00' },
        saturday: { open: '06:00', close: '22:00' },
        sunday: { open: '06:00', close: '21:00' },
      },
      isVerified: true,
      verifiedAt: new Date(),
      trustScore: 4.8,
      averageRating: 4.7,
      totalReviews: 12,
      deliveryEnabled: true,
      deliveryRadius: 5,
      photos: [],
    },
  });

  const treeShop = await prisma.shop.create({
    data: {
      ownerId: treeOwner.id,
      name: 'Tree Nursery',
      slug: 'tree-nursery-blr',
      description: 'Healthy tree saplings and plant care essentials.',
      phone: '9000000002',
      whatsapp: '9000000002',
      address: '44, Green Layout',
      landmark: 'Opp. Lake Gate',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560025',
      latitude: 12.966,
      longitude: 77.611,
      category: 'services',
      isActive: true,
      subCategories: ['Gardening'],
      operatingHours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '20:00' },
        saturday: { open: '08:00', close: '20:00' },
        sunday: { open: '08:00', close: '18:00' },
      },
      isVerified: true,
      verifiedAt: new Date(),
      trustScore: 4.6,
      averageRating: 4.5,
      totalReviews: 9,
      deliveryEnabled: true,
      deliveryRadius: 8,
      photos: [],
    },
  });

  await prisma.product.create({
    data: {
      shopId: milkShop.id,
      name: 'Milk',
      description: 'Fresh full cream milk sourced daily.',
      shortDescription: 'Fresh milk',
      price: 64,
      mrp: 70,
      discount: 9,
      images: ['https://placehold.co/400x400/F0FDFA/0F766E?text=Milk'],
      category: 'grocery',
      subCategory: 'Dairy',
      tags: ['milk', 'dairy', 'fresh'],
      brand: 'Local Dairy',
      inStock: true,
      quantity: 80,
      unit: 'litre',
      searchVector: 'milk dairy fresh local',
    },
  });

  await prisma.product.create({
    data: {
      shopId: treeShop.id,
      name: 'Tree',
      description: 'Healthy native tree sapling ready for planting.',
      shortDescription: 'Tree sapling',
      price: 249,
      mrp: 299,
      discount: 17,
      images: ['https://placehold.co/400x400/F0FDFA/0F766E?text=Tree'],
      category: 'services',
      subCategory: 'Gardening',
      tags: ['tree', 'sapling', 'garden'],
      brand: 'City Nursery',
      inStock: true,
      quantity: 40,
      unit: 'piece',
      searchVector: 'tree sapling gardening plant',
    },
  });

  console.log('Seed complete: only Milk and Tree products plus their owners are retained.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
