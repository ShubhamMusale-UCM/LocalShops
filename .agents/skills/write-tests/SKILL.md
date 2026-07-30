---
name: write-tests
description: Writes unit and integration tests for React Native components, custom hooks, and server routes in CityLocalShop using Jest & React Native Testing Library.
triggers: ["write tests", "add tests", "test this", "unit test"]
turbo_safe: true
---

# Test Writing Skill

When writing tests for `CityLocalShop`:

1. **Test Environment**:
   - Use Jest + `@testing-library/react-native` for mobile components/hooks.
   - Use Jest + Supertest for server API routes.

2. **Test Coverage Requirements**:
   - Test happy path / success state rendering.
   - Test loading state (e.g. ActivityIndicator is present while pending).
   - Test error state (e.g. error message displayed on failure).
   - Test key user interactions (button press, input field typing).

3. **Mocking Rules**:
   - Mock navigation hooks (`useNavigation`, `useRoute`).
   - Mock API services or Axios calls with Jest mocks (`jest.mock(...)`).
   - Mock AsyncStorage / MMKV if state storage is accessed.

4. **Verification**:
   - Save test file under `apps/mobile/__tests__/[ComponentName].test.tsx` or alongside the target file.
   - Execute test command (`npm test`) in Turbo mode to verify tests pass before reporting completion.
