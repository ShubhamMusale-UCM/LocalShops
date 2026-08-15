# /review [Target File / PR]

Triggered by: `/review`

Automated code review macro for `CityLocalShop`.

## Steps:
1. **Inspect Code**: Read specified file or git status/diff.
2. **Check Rules**:
   - **TypeScript & Safety**: Strict typing (no untyped `any`), async try/catch.
   - **UI Component States**: Loading, error (with retry CTA), empty (with icon + subtitle + CTA), success handled.
   - **Design System Compliance**:
     - Uses Primary Sky Blue `#38BDF8` / Dark Background `#050814`.
     - Touch targets minimum 44x44px.
     - Cards use `borderRadius: 16`, `rgba(255,255,255,0.02)` bg, 1px `rgba(255,255,255,0.05)` border, and subtle overlay.
     - Scroll views include `paddingBottom: 100`.
   - **Performance**: No `console.log`, proper list implementation (FlatList/FlashList, no ScrollView.map()).
3. **Generate Concise Audit**:
   - List actionable bugs, design token mismatches, or performance traps.
   - Provide direct code fixes for each identified issue.

