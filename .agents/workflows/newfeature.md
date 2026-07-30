# /newfeature [FeatureName]

Triggered by: `/newfeature`

Automated end-to-end feature skeleton creation workflow for `CityLocalShop`.

## Steps:
1. **Types**: Create `/apps/mobile/src/types/[FeatureName].ts` containing interface definitions for data models and API requests/responses.
2. **API Service**: Create `/apps/mobile/src/services/[featureName]Service.ts` with typed Axios request handlers and error handling.
3. **State Management**: Create `/apps/mobile/src/store/[featureName]Store.ts` using Zustand to handle global state, loading, and error states for the feature.
4. **UI Screen**: Create `/apps/mobile/src/screens/buyer/[FeatureName]Screen.tsx` (or appropriate role subfolder) with SafeAreaView, loading, error, empty, and success states.
5. **Unit Tests**: Create `/apps/mobile/__tests__/[FeatureName].test.tsx` with basic rendering and interaction tests.
6. **Verification**: Run `npm test` or verify imports and syntax across created files.
7. **Report**: Summarize created files, exported symbols, and routing registration steps needed in the app navigator.
