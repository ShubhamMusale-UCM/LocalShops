# Network Upload Error Diagnostic Guide

## What Was Fixed

✅ **Enhanced Error Logging** - API client now shows exact error codes and messages  
✅ **Upload Timeout Extended** - Multipart upload timeout increased to 30 seconds  
✅ **Network Diagnostics** - New utility to test server connectivity before upload  
✅ **Better Error Messages** - User-friendly error hints for common issues  
✅ **Request Logging** - Logs auth token, request URL, method for debugging  

## The "Network Error" During Upload

This error typically means:
- **Network connectivity issue** - Device can't reach the server
- **ngrok tunnel down/expired** - The ngrok URL is no longer active
- **Request timeout** - Upload took too long (now extended to 30 seconds)
- **CORS issue** - Server rejected the multipart request

## How to Debug

### Step 1: Run Connectivity Check

When you get "Network Error", the app will now:
1. Automatically test if server is reachable
2. Show real error code and latency
3. Log everything to React Native console

**Look for logs like:**
```
[AddProduct] Running connectivity check before upload
[NetworkDiagnostics] Testing connectivity to: https://intrinsically-wannest-bristol.ngrok-free.dev/api
[NetworkDiagnostics] Server reachable! Latency: 234 ms
```

### Step 2: Identify the Specific Issue

**If you see "Cannot reach server":**
```
Error: Cannot reach server (getaddrinfo ENOTFOUND ...). 
Check internet and ngrok tunnel.
```
→ **Solution**: 
- Check your internet connection
- Verify ngrok is still running: `ngrok http 5000`
- The ngrok URL expires after ~8 hours - get a new one if needed
- Update `.env` with new ngrok URL

**If you see timeout error:**
```
Error: Upload timeout - server took too long to respond
```
→ **Solution**:
- Your internet is slow
- Try uploading fewer/smaller images
- Check server logs for processing issues

**If you see 401 Unauthorized:**
```
Error: Unauthorized - login expired. Please login again.
```
→ **Solution**:
- Your token expired or is invalid
- Log out and log back in
- Ensure you're logged in as a SELLER

**If you see 403 Forbidden:**
```
Error: Forbidden - you don't have permission to upload
```
→ **Solution**:
- Your user account isn't a SELLER
- Check user role settings

---

## Step 3: Manual Connectivity Test

**Before uploading, test your connection:**

```bash
# Test server health (no auth needed)
curl https://intrinsically-wannest-bristol.ngrok-free.dev/api/health \
  -H "ngrok-skip-browser-warning: 1"
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "CityLocalShop API",
  "version": "1.0.0",
  "timestamp": "2026-04-10T16:32:52.123Z"
}
```

If this fails, your network can't reach the server.

---

## Step 4: Full Console Logs

**After rebuilding the mobile app, when you try to add a product**, capture these logs:

```
[AddProduct] Fetching seller shops
[AddProduct] Uploading 2 local photos
[ProductService] Uploading 2 images to /products/upload-images
[ProductService] FormData entries: 2
[API] Request URL: /products/upload-images
[API] Request Token set: ...
ERROR [ProductService] Upload failed
  Error Code: ...
  Status: ...
  Message: ...
```

**Each piece tells you where it failed:**
- `[AddProduct]` - Mobile app logs
- `[API]` - Request being sent
- `[ProductService]` - Upload attempt
- Error Code - Type of failure

---

## Common Error Codes

| Error Code | Meaning | Solution |
|-----------|---------|----------|
| `ENOTFOUND` | DNS/hostname not found | Check ngrok URL, internet connection |
| `ECONNREFUSED` | Server not running/reachable | Start server, verify port 5000 |
| `ECONNABORTED` | Request timeout | Increase timeout or use smaller images |
| `ECONNRESET` | Connection reset by server | Server crashed - restart it |
| `400` HTTP | Bad request (validation failed) | Check logs for validation errors |
| `401` HTTP | Not authenticated | Login required |
| `403` HTTP | Not authorized | Check user role |
| `500` HTTP | Server error | Check server logs |

---

## When to Use for Testing

**1. Before attempting upload:**
```javascript
// The app will now automatically do this
const check = await networkDiagnostics.testServerConnectivity();
// Logs full diagnostics before upload
```

**2. Manual testing (for developers):**
```javascript
// In React Native console or debugger
import { networkDiagnostics } from './utils/networkCheck';
await networkDiagnostics.runFullDiagnostics();
```

This will log:
- API Base URL
- Server connectivity status
- Latency
- Any errors encountered

---

## Checklist Before Uploading

- [ ] Backend server is running: `npm run dev` in `CityLocalShop/server/`
- [ ] Mobile app is rebuilt with latest code
- [ ] You're logged in as a SELLER (not BUYER)
- [ ] ngrok tunnel is active and URL is correct in `.env`
- [ ] Internet connection is working
- [ ] Image files are valid (not corrupted)
- [ ] Images are not too large (< 20MB each)

---

## Troubleshooting Steps

### If still getting "Network Error":

1. **Restart everything:**
   ```bash
   # Terminal 1: Restart backend
   cd CityLocalShop/server
   npm run dev
   
   # Terminal 2: Clear and rebuild mobile app
   cd CityLocalShop/apps/mobile
   npx expo start -c  # -c clears cache
   ```

2. **Check ngrok status:**
   ```bash
   # Terminal 3: Verify ngrok tunnel
   curl https://intrinsically-wannest-bristol.ngrok-free.dev/api/health \
     -H "ngrok-skip-browser-warning: 1"
   ```

3. **If ngrok URL changed**, update `.env`:
   ```bash
   # In CityLocalShop/apps/mobile/.env
   EXPO_PUBLIC_API_BASE_URL=https://YOUR_NEW_NGROK_URL/api
   ```

4. **Check mobile logs** for detailed error info

5. **Share the React Native console output** including all `[AddProduct]`, `[ProductService]`, and error logs

---

## What's Happening Now

When you try to add a product:
1. ✅ Connectivity check validates server is reachable
2. ✅ Shows actual error code if network fails
3. ✅ Extended timeout for slow uploads
4. ✅ Provides helpul error messages instead of generic "Network Error"
5. ✅ Logs auth token presence
6. ✅ Shows request URL and method

All of this helps diagnose exactly where the upload is failing.
