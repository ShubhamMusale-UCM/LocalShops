import request from 'supertest';
import app from '../src/app';
import { prismaMock as prisma } from './setup';
import { generateTestToken } from './utils';

describe('Product Bulk Import (CSV)', () => {
  it('should upload a CSV and process products', async () => {
    // 1. Setup mock data
    const mockUser = {
      id: 'seller-456',
      role: 'SELLER',
      isActive: true,
      email: 'seller@example.com',
      phone: '+1987654321',
      name: 'Test Seller'
    };
    const token = generateTestToken(mockUser.id, mockUser.role, mockUser.phone);

    const mockShop = {
      id: 'shop-789',
      ownerId: mockUser.id,
      subscriptionPlan: 'STARTER'
    };

    // 2. Mock Prisma returns
    prisma.user.findUnique.mockResolvedValue(mockUser as any);
    prisma.shop.findUnique.mockResolvedValue(mockShop as any);
    prisma.product.count.mockResolvedValue(0);
    prisma.product.createMany.mockResolvedValue({ count: 2 });

    // 3. Prepare CSV content
    const csvContent = `name,description,price,mrp,quantity,category,tags
Product 1,Description 1,100,120,50,Electronics,"tag1,tag2"
Product 2,Description 2,200,250,10,Clothing,"tag3"`;

    // 4. Perform upload
    const response = await request(app)
      .post(`/api/products/shop/${mockShop.id}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csvContent), { filename: 'products.csv', contentType: 'text/csv' });

    // 5. Assertions
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('successCount', 2);
    expect(response.body).toHaveProperty('errorCount', 0);
    expect(response.body).toHaveProperty('totalProcessed', 2);
    expect(prisma.product.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'Product 1', price: 100, quantity: 50 }),
        expect.objectContaining({ name: 'Product 2', price: 200, quantity: 10 })
      ]),
      skipDuplicates: true
    });
  });

  it('should return errors for invalid rows', async () => {
    const mockUser = { id: 'seller-456', role: 'SELLER', isActive: true, phone: '123' };
    const token = generateTestToken(mockUser.id, mockUser.role, mockUser.phone);
    const mockShop = { id: 'shop-789', ownerId: mockUser.id, subscriptionPlan: 'STARTER' };

    prisma.user.findUnique.mockResolvedValue(mockUser as any);
    prisma.shop.findUnique.mockResolvedValue(mockShop as any);
    prisma.product.count.mockResolvedValue(0);
    prisma.product.createMany.mockResolvedValue({ count: 1 });

    const csvContent = `name,description,price
Valid Product,Desc,100
,Invalid - No Name,50
Another Valid,Desc2,
`; // row 2 missing name, row 3 missing price

    const response = await request(app)
      .post(`/api/products/shop/${mockShop.id}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csvContent), { filename: 'products.csv', contentType: 'text/csv' });

    expect(response.status).toBe(201);
    expect(response.body.successCount).toBe(1);
    expect(response.body.errorCount).toBe(2);
    expect(response.body.errors).toHaveLength(2);
  });
});
