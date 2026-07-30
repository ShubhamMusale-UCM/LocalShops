---
name: api-service
description: Builds typed API service files with standardized Axios client, error handling, and TypeScript response models for CityLocalShop.
triggers: ["create service", "api service", "build service", "new service"]
turbo_safe: false
---

# API Service Skill

When creating or modifying an API service file in `apps/mobile/src/services/` or `server/src/services/`:

1. **HTTP Client & Configuration**:
   - Use the shared Axios client instance (e.g., `import api from './api'`).
   - Never instantiate duplicate Axios instances with conflicting base URLs.

2. **Typing & Validation**:
   - Explicitly type all Request payloads and Response types in TypeScript.
   - Use Zod schemas where validation is required before mutating state.

3. **Standard Error Handling**:
   - Wrap all API calls in `try/catch`.
   - Log or transform errors into typed `ApiError` objects containing status code and human-readable message (`error.response?.data?.message || error.message`).
   - Explicitly handle 401 (token refresh / session expired), 403 (unauthorized access), 404 (resource not found), and 500 (server error).

4. **Export Pattern**:
   - Export individual named async service functions (e.g. `export const fetchProductDetails = async (id: string)...`).
