2024-06-11 - QazaDetailSheet Touch Targets & Loading States
Learning: Interactive elements in the QazaDetailSheet were too small for comfortable mobile use (under 44px) and lacked loading/disabled states during API calls, leading to potential duplicate submissions and poor UX.
Action: Enforce a minimum touch target size of 44px (e.g., using Tailwind's min-h-[44px]) for all interactive buttons and inputs. Implement explicit loading and disabled states for async actions to provide immediate visual feedback.

2025-03-03 - Mobile Action Buttons
Learning: A repeated usability issue is that horizontal action buttons on list items become too small and clustered on mobile, especially when using icon-only buttons for unselected states. This leads to difficult thumb targeting and unclear actions.
Action: When designing horizontal button groups for mobile, especially in lists like prayer cards, enforce stacked flex layouts (`flex-col sm:flex-row`). Allow buttons to span the full available width using `flex-[n]` or `flex-1` classes. Always use clear text labels alongside icons (e.g., "Missed" / "Miss", "Prayed" / "Pray") rather than relying on icons alone, to meet accessibility and usability standards.
2024-07-06 - [Qaza List Mobile Optimization]
Learning: Multi-column grid layouts for interactive lists (like Qaza tracking) create uncomfortably small tap targets and feel cramped on mobile screens. A single-column layout using full-width rows with explicit visual affordances (`ChevronRight`) provides a much better mobile native feel and easier interaction.
Action: Use single-column stacked lists for drill-down navigation screens instead of dense multi-column grids. Always add a visual affordance icon (like a chevron) to cards to indicate they are tappable and open detailed views.

2025-07-12 - Daily Prayer Logging Touch Targets
Learning: Horizontal action buttons in lists like prayer cards become too cramped on mobile, limiting thumb reachability and conflicting with minimum touch target sizes (44px).
Action: Use stacked flex layouts (`flex-col sm:flex-row`) with `w-full` buttons on mobile to ensure action buttons span the full width comfortably while remaining horizontal on larger screens. Avoid removing responsive flex width overrides (`sm:flex-none`) that break intended desktop visual hierarchy.
