# /optimize [Target Component / Screen]

Triggered by: `/optimize`

Performance and rendering optimization macro for `CityLocalShop`.

## Steps:
1. **Analyze Component**: Inspect target React Native component or screen code.
2. **Detect Bottlenecks**:
   - Unnecessary inline object/function instantiations passed as props.
   - Missing `useCallback` or `useMemo` on expensive calculations.
   - Large dynamic lists using `ScrollView` + `.map()` instead of `FlatList`.
   - Missing `getItemLayout` or keyExtractor optimization on lists.
   - Excessive state updates triggering full tree re-renders.
3. **Refactor Code**: Provide optimized drop-in component code.
4. **Summary**: Explain specific performance wins and frame drop reductions.
