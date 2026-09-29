# Personalized Search Ads Documentation

## Overview
The Personalized Search Ads feature dynamically bridges user intent (via search queries) with targeted ad campaigns, maximizing relevance and Click-Through-Rate (CTR). 

This is accomplished by non-invasively tracking what users search for, deduplicating those keywords, and mapping them against the descriptions, categories, and titles of active sponsored listings (ads).

## Workflow (End-to-End)

1. **User Search (Tracking Phase)**
   - **Endpoint:** `GET /search/products`, `GET /search/advanced`
   - **Mechanism:** Whenever a user executes a search, the query is passed to `trackUserSearchHistory(userId, keyword)` inside the `SearchController`. 
   - **Performance:** This is executed asynchronously as a "fire-and-forget" promise. It will never block the API response time.
   - **Database Storage:** The keyword is persisted to the new `UserSearchHistory` table in PostgreSQL mapped to the user's UUID.

2. **Personalized Ads Engine (Targeting Phase)**
   - **Endpoint:** `GET /ads/personalized`
   - **Mechanism:** When requested, the `AdsService.getPersonalizedAds` runs the targeting algorithm.
   - **Logic:**
     - Fetches the user's latest 20 searches and extracts unique keywords.
     - Performs a dynamic Prisma `$OR` query matching these keywords against active `PromotedListing` products (`product.name`, `product.description`, `product.category`).
     - **Pacing Constraint:** Verifies the ad budget spend ratio compared to campaign time elapsed.
     - **Geo-Constraint:** Applies bounding box and Haversine distance penalties to rank nearby ads higher.
   - **Fallback:** If a user has no search history or is unauthenticated, it seamlessly routes to `getTrendingProducts` using global trends.

3. **Frontend Implementation (Mobile App)**
   - **Service:** `adsService.getPersonalized(limit, lat, lng)` wrapper is introduced.
   - **UI Rendering:** In `HomeScreen.tsx`, if the active category is `"all"`, the app calls the personalized endpoint. 
   - **Dynamic Display:** The section title automatically updates to **"Recommended for You"** when personalized data is shown instead of "Trending Products".

## Code Modifications Summary
- **Database:** `server/prisma/schema.prisma` (Added `UserSearchHistory` model)
- **Backend Search:** `server/src/modules/search/search.controller.ts` & `search.routes.ts`
- **Backend Ads:** `server/src/modules/ads/ads.service.ts`, `ads.controller.ts`, & `ads.routes.ts`
- **Frontend App:** `apps/mobile/src/services/adsService.ts` & `apps/mobile/src/screens/buyer/HomeScreen.tsx`
