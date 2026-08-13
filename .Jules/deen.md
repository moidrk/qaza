2024-06-11 - QazaDetailSheet Touch Targets & Loading States\nLearning: Interactive elements in the QazaDetailSheet were too small for comfortable mobile use (under 44px) and lacked loading/disabled states during API calls, leading to potential duplicate submissions and poor UX.\nAction: Enforce a minimum touch target size of 44px (e.g., using Tailwind's min-h-[44px]) for all interactive buttons and inputs. Implement explicit loading and disabled states for async actions to provide immediate visual feedback.

2025-03-03 - Mobile Action Buttons
Learning: A repeated usability issue is that horizontal action buttons on list items become too small and clustered on mobile, especially when using icon-only buttons for unselected states. This leads to difficult thumb targeting and unclear actions.
Action: When designing horizontal button groups for mobile, especially in lists like prayer cards, enforce stacked flex layouts (`flex-col sm:flex-row`). Allow buttons to span the full available width using `flex-[n]` or `flex-1` classes. Always use clear text labels alongside icons (e.g., "Missed" / "Miss", "Prayed" / "Pray") rather than relying on icons alone, to meet accessibility and usability standards.
2024-07-06 - [Qaza List Mobile Optimization]
Learning: Multi-column grid layouts for interactive lists (like Qaza tracking) create uncomfortably small tap targets and feel cramped on mobile screens. A single-column layout using full-width rows with explicit visual affordances (`ChevronRight`) provides a much better mobile native feel and easier interaction.
Action: Use single-column stacked lists for drill-down navigation screens instead of dense multi-column grids. Always add a visual affordance icon (like a chevron) to cards to indicate they are tappable and open detailed views.
2023-10-27 - [Prayer Logging Mobile UX]
Learning: Mobile interactive elements (like prayer logging buttons) must prioritize large touch targets over compact horizontal layouts. Relying on icon-only buttons with  on mobile creates usability issues for daily tracking.
Action: Use stacked layouts (`flex-col-reverse`) and full-width buttons (`w-full`) with clear text labels on mobile viewports for key daily actions, preserving horizontal layouts for desktop.
2023-10-27 - [Prayer Logging Mobile UX]
Learning: Mobile interactive elements (like prayer logging buttons) must prioritize large touch targets over compact horizontal layouts. Relying on icon-only buttons with `w-11` on mobile creates usability issues for daily tracking.
Action: Use stacked layouts (`flex-col-reverse`) and full-width buttons (`w-full`) with clear text labels on mobile viewports for key daily actions, preserving horizontal layouts for desktop.
