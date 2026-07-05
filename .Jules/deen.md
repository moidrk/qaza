2024-06-11 - QazaDetailSheet Touch Targets & Loading States\nLearning: Interactive elements in the QazaDetailSheet were too small for comfortable mobile use (under 44px) and lacked loading/disabled states during API calls, leading to potential duplicate submissions and poor UX.\nAction: Enforce a minimum touch target size of 44px (e.g., using Tailwind's min-h-[44px]) for all interactive buttons and inputs. Implement explicit loading and disabled states for async actions to provide immediate visual feedback.

2025-03-03 - Mobile Action Buttons
Learning: A repeated usability issue is that horizontal action buttons on list items become too small and clustered on mobile, especially when using icon-only buttons for unselected states. This leads to difficult thumb targeting and unclear actions.
Action: When designing horizontal button groups for mobile, especially in lists like prayer cards, enforce stacked flex layouts (`flex-col sm:flex-row`). Allow buttons to span the full available width using `flex-[n]` or `flex-1` classes. Always use clear text labels alongside icons (e.g., "Missed" / "Miss", "Prayed" / "Pray") rather than relying on icons alone, to meet accessibility and usability standards.

2025-07-04 - Qaza List Mobile Layout
Learning: The Qaza List was using a generic 2-column grid layout (`grid grid-cols-2`), which became too dense on mobile screens, limiting touch targets and readability. The cards also lacked visual affordance for their interactiveness.
Action: For mobile lists, prefer full-width stacked layouts (`flex flex-col w-full`) over multi-column grids. Provide explicit interactive affordance by adding a `ChevronRight` icon (or similar) to indicate that the list item can be tapped to open a detail view.
