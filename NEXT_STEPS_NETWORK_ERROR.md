# "Network Error" Upload - Next Steps

## ✅ What I Fixed

### Backend Improvements
- Better error handling for Zod validation errors
- Improved error messages in product controller
- Health check endpoint verified working

### Mobile App Improvements
- ✅ **Network Diagnostics Utility** - `apps/mobile/src/utils/networkCheck.ts`
  - Automatically tests connectivity to server
  - Shows exact error code and latency
  - Provides helpful error messages

- ✅ **Enhanced Error Logging** in API client (`api.ts`)
  - Shows request URL, auth token status
  - Detailed error code information
  - Full response data on failure

- ✅ **Upload Timeout Extended** to 30 seconds (from 15 seconds)

- ✅ **Better Error Messages** in ProductService
  - `ECONNABORTED` → "Upload timeout"
  - `ENOTFOUND` → "Cannot reach server"
  - `401` → "Login expired"
  - etc.

- ✅ **Connectivity Check in AddProductScreen**
  - Runs before upload
  - Shows real error details
  - Better user-facing error messages

---

## 🚀 What to Do Now

### Step 1: Rebuild Mobile App
```bash
cd CityLocalShop/apps/mobile
npx expo start -c    # -c clears cache
```

### Step 2: Try Adding Product Again
The app will now:
1. Check connectivity first
2. Show REAL error message instead of "Network Error"
3. Log detailed diagnostics to console

### Step 3: Check Console Output
Look for logs like:

**✅ Good - Upload works:**
```
[AddProduct] Running connectivity check before upload
[NetworkDiagnostics] Server reachable! Latency: 234 ms
[AddProduct] Uploading 2 local photos
[ProductService] Upload successful: {...}
```

**❌ Bad - Connectivity issue:**
```
[AddProduct] Running connectivity check before upload
[NetworkDiagnostics] Server not reachable
Error Code: ENOTFOUND
Error message: getaddrinfo ENOTFOUND intrinsically-wannest-bristol.ngrok-free.dev
```

---

## 🔍 Common Diagnostics & Fixes

### "Cannot reach server (getaddrinfo ENOTFOUND)"
**Cause:** ngrok tunnel URL is invalid or expired  
**Fix:**
1. ngrok URLs expire after ~8 hours
2. Run: `ngrok http 5000` in new terminal
3. Copy new URL to `.env` EXPO_PUBLIC_API_BASE_URL
4. Rebuild mobile app

### "Upload timeout"
**Cause:** Server took too long to respond  
**Fix:**
- Try smaller images
- Check server logs for errors
- Ensure internet is not congested

### "Unauthorized - login expired"
**Cause:** Auth token is invalid  
**Fix:**
- Logout and login again in the app
- Token was likely revoked

### "Forbidden - you don't have permission"
**Cause:** User is not a SELLER  
**Fix:**
- Ensure you're logged in as SELLER role
- Check account settings

---

## 📋 Verification Checklist

Before trying again:

- [ ] Backend is running: `npm run dev` in `/server` folder
- [ ] Backend responds to health check:
  ```bash
  curl http://localhost:5000/api/health
  ```
  Should return `{"status":"ok",...}`

- [ ] ngrok tunnel is active:
  ```bash
  curl https://your-ngrok-url-here.ngrok-free.dev/api/health
  ```

- [ ] Mobile app is rebuilt with cache cleared:
  ```bash
  npx expo start -c
  ```

- [ ] You're logged in as SELLER (not BUYER)

- [ ] Internet connection is working

---

## 📊 Real Error Information Will Now Show

Instead of generic "Network Error", you'll see specifics like:

```
Error Code: ECONNABORTED
Status: undefined
Status Text: undefined  
Message: timeout of 15000ms exceeded
Response: undefined
```

Or:

```
Error Code: undefined
Status: 401
Status Text: Unauthorized
Message: Request failed with status code 401
Response: {"error": "Invalid token. User not found."}
```

This makes it MUCH easier to diagnose the real issue.

---

## 🎯 Expected Behavior After Fixes

1. **App starts** → Logs "Initialized with BASE_URL: ..."
2. **Click Add Product** → Form validation works
3. **Click Submit with images** → Before upload:
   - Runs connectivity check
   - Logs server reachability + latency
   - If reachable → uploads images
   - If not reachable → shows specific error

4. **During upload** → Logs every step:
   - Image count being uploaded
   - Request URL and method
   - Auth token presence
   - Response status

5. **On error** → Shows helpful message:
   - "Cannot reach server" (with fix suggestion)
   - "Upload took too long" (retry or use smaller images)
   - "Login expired" (re-authenticate)
   - "Validation failed" (specific field errors)

---

## 🐛 If Still Getting Network Error After This

1. **Check server logs** - Terminal where `npm run dev` is running
2. **Share FULL console output** - All [AddProduct], [ProductService], [API], [NetworkDiagnostics] logs
3. **Share error response** - What does the error message say now?
4. **Verify ngrok** - Is URL still valid? Did it expire?

---

## 📚 Documentation Created

I've created 2 guides in the project:

1. **`ADD_PRODUCT_TROUBLESHOOTING.md`** - Complete troubleshooting guide
2. **`NETWORK_ERROR_DIAGNOSTICS.md`** - Network-specific diagnostics

Both have:
- Error codes explanation
- Manual endpoint testing commands
- Step-by-step debugging
- Common mistakes to avoid

---

## Summary

The "Network Error" was too generic to debug. I've added:
- ✅ Real error codes  
- ✅ Automatic connectivity checks
- ✅ Extended timeout for uploads
- ✅ Detailed logging at every step
- ✅ User-friendly error messages

**Next Action:** Rebuild mobile app and try adding product. The console logs will now show EXACTLY what's failing.
