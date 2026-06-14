2024-06-11 - QazaDetailSheet Touch Targets & Loading States\nLearning: Interactive elements in the QazaDetailSheet were too small for comfortable mobile use (under 44px) and lacked loading/disabled states during API calls, leading to potential duplicate submissions and poor UX.\nAction: Enforce a minimum touch target size of 44px (e.g., using Tailwind's min-h-[44px]) for all interactive buttons and inputs. Implement explicit loading and disabled states for async actions to provide immediate visual feedback.

2024-06-14 - Responsive Stacked Action Layouts
Learning: Horizontal action items (e.g. "Missed", "Prayed" buttons) on list cards squeeze on small mobile screens causing small touch targets and overlapping content.
Action: Use responsive wrappers (`flex-col sm:flex-row`) with full-width CSS Grids on mobile (`grid grid-cols-2 w-full`) that fallback to flex rows on desktop (`sm:w-auto sm:flex sm:grid-cols-none`) for multiple actions within list items.
