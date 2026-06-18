2024-06-18 - [Daily Prayer Logging Mobile Touch Targets]
Learning: Mobile lists containing multiple side-by-side action buttons naturally squeeze into small touch targets (<44px). Icon-only buttons lacking text labels further hinder usability by reducing click area and clarity.
Action: Prefer stacked flex layouts (`flex-col sm:flex-row`) with `w-full` for list items, paired with proportional flexing (`flex-[n]`) for button groups to guarantee massive, clear, text-labeled targets that fill screen width on mobile devices.
