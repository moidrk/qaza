2024-06-11 - QazaDetailSheet Touch Targets & Loading States
Learning: Interactive elements in the QazaDetailSheet were too small for comfortable mobile use (under 44px) and lacked loading/disabled states during API calls, leading to potential duplicate submissions and poor UX.
Action: Enforce a minimum touch target size of 44px (e.g., using Tailwind's min-h-[44px]) for all interactive buttons and inputs. Implement explicit loading and disabled states for async actions to provide immediate visual feedback.

2025-03-03 - Mobile Action Buttons
Learning: A repeated usability issue is that horizontal action buttons on list items become too small and clustered on mobile, especially when using icon-only buttons for unselected states. This leads to difficult thumb targeting and unclear actions.
Action: When designing horizontal button groups for mobile, especially in lists like prayer cards, enforce stacked flex layouts (`flex-col sm:flex-row`). Allow buttons to span the full available width using `flex-[n]` or `flex-1` classes. Always use clear text labels alongside icons (e.g., "Missed" / "Miss", "Prayed" / "Pray") rather than relying on icons alone, to meet accessibility and usability standards.

2024-07-03 - Mobile Stacked List Layouts
Learning: Using grid layouts (e.g. grid-cols-2) for dense dashboards is poorly suited for mobile navigation lists in Qaza Tracker. Interactive list items on mobile should use a stacked vertical layout with explicit horizontal content flow (!flex-row) and a clear visual affordance (ChevronRight) to indicate tap action.
Action: When designing lists of interactive cards on mobile, use flex-col for the list container and override default flex-col styles on individual Cards with !flex-row. Ensure text is left-aligned and provide an icon affordance on the right to meet mobile UX standards.
