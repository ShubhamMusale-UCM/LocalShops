# Add Product Troubleshooting Guide

## Latest Improvements (Just Applied)

✅ Better error handling in backend controllers - now returns Zod validation errors correctly  
✅ Improved logging in AddProductScreen to trace each step  
✅ Better error messages in mobile UI - shows actual error cause  
✅ Network error logging in productService  

## How to Debug "Failed to Add Product"

### Step 1: Check React Native Console Logs

When you try to add a product and get the error, look for logs starting with:
- `[AddProduct]` - from AddProductScreen
- `[ProductService]` - from productService
- `[API]` - from api client

These will show:
- Which step failed (upload, shop fetch, product create)
- The exact API response error

### Step 2: Identify The Failure Point

#### Scenario 1: Image Upload Fails
```
[AddProduct] Uploading N local photos
[ProductService] Upload error: {...error response...}
→ Error message: "Image upload failed. Expected X images, got Y"
```

**Solutions:**
- Check image file sizes (should be <20MB per image)
- Ensure images are valid (JPEG, PNG, HEIC, GIF format)
- Verify server `/products/upload-images` endpoint is working
- Check authorization token is being sent (look for 401 error)

#### Scenario 2: Shop Fetch Fails
```
[AddProduct] Fetching seller shops
Error: {...error response...}
```

**Solutions:**
- Verify you're logged in as a seller
- Check authorization token is valid (not expired)
- Ensure your user has at least one shop or can auto-create one

#### Scenario 3: Shop Auto-Creation Fails
```
[AddProduct] No shops found, auto-creating shop
[AddProduct] Auto-create shop response: {...error...}
Error: "Shop auto-creation failed..."
```

**Solutions:**
- Verify profile is complete with:
  - Name
  - Phone number (10 digits, valid format)
- Check shop creation endpoint errors

#### Scenario 4: Product Creation Fails
```
[AddProduct] Creating product with shopId: UUID
Error: {...error response...}
```

**Solutions:**
- Check each required field:
  - Product name (min 2 chars)
  - Description (min 10 chars)
  - Price (must be > 0)
  - Category (must be selected)
  - At least 1 image (should be uploaded successfully)
- Look for validation errors in console logs

### Step 3: Common Error Responses

If you see these errors, here's what they mean:

```
"Access denied. No token provided." (401)
→ Not authenticated. Try logging out and back in.

"Invalid token. User not found." (401)  
→ Token is invalid or user account deleted. Re-login required.

"Not authorized for this action." (403)
→ Your user role is not SELLER. Check if account is set up correctly.

"Shop not found." (404)
→ Shop UUID doesn't exist or was deleted.

"Not authorized." (403)
→ Trying to create product for a shop you don't own.

"Product limit reached for FREE plan..." (400)
→ Upgrade subscription or delete old products.

"At least one image is required" (400)
→ Image upload failed or returned empty. Check upload logs.

"Description must be at least 10 characters" (400)
→ Validation error. Fill in all required fields properly.
```

### Step 4: Test the Endpoints Directly (Advanced)

If logs don't help, test endpoints with cURL:

**1. Check if server is running:**
```bash
curl http://localhost:5000/api/products/trending?lat=12.9&lng=77.5
```

**2. Test image upload (requires valid token):**
```bash
curl -X POST http://localhost:5000/api/products/upload-images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image.jpg"
```

**3. Test product creation:**
```bash
curl -X POST http://localhost:5000/api/products/shop/SHOP_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "This is a test product description",
    "price": 100,
    "category": "Groceries",
    "images": ["http://localhost:5000/uploads/products/..."]
  }'
```

### Step 5: Full Diagnostic Flow

**To test the entire flow manually:**

1. **Start the server:**
   ```bash
   cd CityLocalShop/server
   npm run dev
   ```

2. **Authenticate as seller** (in mobile app or via API)

3. **Try adding a product** and watch the console

4. **Copy the full error message** from console logs

5. **Share error details** for more specific help

## Data Requirements Checklist

✅ Product Name: 2-200 characters  
✅ Description: 10-5000 characters  
✅ Price: > 0 (e.g., 100, 50.5)  
✅ Category: Selected from list  
✅ Images: At least 1, max 10  
✅ Quantity (optional): ≥ 0  
✅ Unit (optional): pcs, kg, L, etc.  

## Common Mistakes to Avoid

❌ Typing description too short (<10 chars)  
❌ Setting price to 0 or negative  
❌ Not selecting a category  
❌ Adding 0 images  
❌ Category name doesn't match predefined list  
❌ Not being logged in as a SELLER role  

## Backend Server Logs

The server terminal will also show errors. Look for:
- `Error:` messages when processing requests
- Database errors
- Authentication failures
- Validation errors

## Need More Help?

1. **Check server logs** in the terminal where you ran `npm run dev`
2. **Check mobile console** for [AddProduct] and [ProductService] logs
3. **Verify backend is running** - should see startup message
4. **Verify API URL** - check `apps/mobile/.env` EXPO_PUBLIC_API_BASE_URL
5. **Try different product data** - simple name, valid price, minimum description
