### What changed

Updated the flex layout of the daily prayer cards in `src/components/PrayerList.tsx` to expand the action buttons ("Miss" and "Pray") on mobile viewports. Replaced the strict single-row layout with `flex-col sm:flex-row`, which stacks the details and actions vertically on very small screens, and used `flex-1` and `flex-[2]` to make the buttons fill the available horizontal space instead of remaining squished.

### Why it matters

The daily prayer cards are the primary interaction point for the application. The previous layout constrained the action buttons, making them small and too difficult to reliably tap with a thumb on mobile screens, leading to misclicks.

### Mobile UX impact

This significantly increases the touch target width for the primary actions on mobile, filling the screen horizontally instead of squishing together. The interaction is much faster and reduces errors.

### Accessibility impact

The label for missing a prayer now includes the text "Miss" visually on screen instead of relying solely on an icon, improving clarity while still maintaining the `aria-label`s. Touch targets easily exceed the comfortable 44px threshold in width.

### Verification

Run the following commands successfully:
- `npm run lint`: Passed
- `npm run test:push`: Passed
- `npm run build`: Passed

### Files changed

- `src/components/PrayerList.tsx`
- `.Jules/deen.md`
