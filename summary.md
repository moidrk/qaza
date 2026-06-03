### What changed
I implemented targeted accessibility improvements in two core interactive areas of the mobile app:
1. **Qaza List Cards (`QazaClient.tsx`)**: Added `role="button"`, explicit `aria-label` detailing the remaining count, keyboard navigation (Enter/Space), and `tabIndex={0}`.
2. **Quick Catch-Up (`QuickCatchUp.tsx`)**: Added `aria-label`, `aria-expanded`, and `aria-controls` to the floating action button to clarify its purpose. Added an explicit `aria-label` to the close button inside the drawer, and gave the drawer container an ID so it can be controlled by the main button.

### Why it matters
Users rely on the Qaza list and Quick Catch-up features every day to log their prayers. Previously, these components relied heavily on visual states and generic HTML tags (e.g., `<Card onClick={...}>` or icon-only buttons), which meant screen readers couldn't properly announce what the element did or its current state. By defining these explicitly, the app aligns better with its mission to be inclusive and easy to use.

### Mobile UX impact
For keyboard or assistive device users navigating on mobile, they can now clearly understand the intent of the Quick Catch-up button (e.g. "Open Quick Catch-up") and explicitly hear the remaining count for each Qaza prayer card without having to rely on visual scanning. Keyboard events guard against `!e.repeat` to prevent spamming mutations if a user holds down a key.

### Accessibility impact
- **Keyboard Support**: Full Enter/Space key support on Qaza list cards.
- **ARIA Labels**: Descriptive labels applied to the main FAB and close button.
- **ARIA States**: Added `aria-expanded` and `aria-controls` to better wire the bottom action drawer to its toggle button.

### Verification
The following commands were run and passed successfully:
- `npm run lint`
- `npm run build`
- `npm run test:push`

### Files changed
- `src/components/QazaClient.tsx`
- `src/components/QuickCatchUp.tsx`
