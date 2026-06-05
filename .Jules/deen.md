## 2024-05-25 - Improve Qaza Empty State Visibility
**Learning:** In the mobile Qaza view, missing items or zero counts can blend in with regular pending items. The "0 remaining" state was hard to distinguish from active backlog items when scanning the grid of cards on mobile.
**Action:** Always visually differentiate "caught up" (zero backlog) states using styling like reduced opacity, different border colors, or specific success messaging (e.g. "Caught Up", "Alhamdulillah") to make the user's active to-do list instantly obvious.

## 2024-05-25 - Improve Screen Reader Accessibility and Mobile Touch Targets
**Learning:** Core interaction components (like prayer logging cards) were relying entirely on visual color changes and icons to convey state, making them inaccessible to screen readers. Bottom navigation items lacked adequate touch target sizes and feedback.
**Action:** Always ensure interactive elements have a `role="button"`, proper `aria-pressed`/`aria-disabled` states, and explicit `aria-label`s. Also, strictly adhere to mobile touch target standards (minimum 44x44px) with clear `active:scale` touch feedback for all navigation elements.

## 2024-05-25 - Advanced Micro-Interactions & Delight
**Learning:** A static mobile app feels like a desktop website. Adding tactile feedback and micro-animations significantly increases user engagement and satisfaction, especially for repetitive daily tasks like checking off prayers.
**Action:** When appropriate, use Framer Motion for satisfying `whileTap` scaling, add celebratory animations (like ring bursts) upon task completion, and utilize native capabilities like `navigator.vibrate` to provide a truly native app feel.
## 2025-02-18 - Prayer Card Status Clarity
**Learning:** Prayer status was primarily conveyed via a checkmark, which can be ambiguous. Users need explicit text to understand status quickly.
**Action:** Future agents should ensure critical states use both icons and text (e.g. 'Completed' vs 'Pending') and ensure actionable cards have tactile feedback like 'active:scale-[0.98]'.

## 2026-06-05 - Adding aria-labels to icon-only buttons
**Learning:** The application uses several `size="icon"` buttons without accessible names.
**Action:** Ensure all future icon-only components include an explicit `aria-label` or screen-reader-only text so assistive technologies can announce their purpose.
