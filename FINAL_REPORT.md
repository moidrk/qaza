# Qaza Tracker - Performance & Optimization Audit Report

## 1. Executive Summary
A comprehensive performance audit was conducted on the Qaza Tracker application within a local Next.js production environment. Utilizing Lighthouse and manual code inspection, critical performance bottlenecks were identified, particularly around main-thread execution time and large JavaScript payloads. Targeted optimizations were applied, leading to a substantial improvement in the overall Performance score from **59** to **98**.

## 2. Core Web Vitals (Before & After)

| Metric | Before Optimization | After Optimization | Improvement |
| :--- | :--- | :--- | :--- |
| **Performance Score** | 59 / 100 | 98 / 100 | +39 points |
| **Largest Contentful Paint (LCP)** | 3.7 s | 1.5 s | -2.2 s (Faster) |
| **Total Blocking Time (TBT)** | 2,030 ms | 160 ms | -1,870 ms (Faster) |
| **Cumulative Layout Shift (CLS)** | 0.093 | 0.000 | Perfect Score |

## 3. Identified Bottlenecks
During the initial scan, the following issues were discovered:
- **Unused/Heavy JavaScript (Main Thread Blocking):** The primary issue slowing down the application was the immediate loading of heavy, non-critical components. Specifically, `recharts` (a complex charting library) and large hidden modal components (`OnboardingWizard` and `CheckInModal`) were bundled into the initial payload, causing significant parsing and compilation delays.
- **Font Rendering Delays:** The primary font (`Outfit`) was lacking an explicit font-display strategy, potentially contributing to invisible text flashes during the critical rendering path.
- **CSS Render Blocking:** Global and utility CSS bundles were flagged as mildly render-blocking, although mostly constrained by the Next.js automated CSS handling.

## 4. Implemented Optimizations
The following fixes were implemented directly into the codebase:
- **Lazy Loading Implementation (`next/dynamic`):**
  - Refactored `src/components/HomeClient.tsx` to dynamically import `OnboardingWizard` and `CheckInModal` since these elements are either conditionally rendered or not required for the immediate above-the-fold experience.
  - Refactored `src/components/AnalyticsClient.tsx` to dynamically import `ConsistencyHeatmap`.
  - Created a dedicated wrapper component `src/components/WeeklyChart.tsx` to house the `recharts` library components (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`). This component is now dynamically imported into `AnalyticsClient.tsx`, stripping the massive charting library from the main application bundle.
- **Font Loading Optimization:**
  - Updated the Next.js `Outfit` font configuration in `src/app/layout.tsx` to use `display: "swap"`. This ensures text remains visible using a fallback font while the web font is downloading, immediately improving First Contentful Paint (FCP) and LCP.

## 5. Future Recommendations & Manual Oversight Required
While the automated metrics are now excellent, the following areas require manual developer oversight moving forward:
1. **Icon Tree-Shaking:** The app heavily uses `lucide-react`. Ensure that named imports are correctly tree-shaken by the bundler. If bundle sizes creep up again, consider creating a custom icon sprite sheet or dynamically importing specific icons.
2. **Third-Party Integrations:** As new analytics or tracking scripts are added, they should be loaded using Next.js `@next/third-parties` or the `next/script` component with the `strategy="lazyOnload"` flag to prevent regression of the TBT score.
3. **Tailwind CSS Optimization:** Verify that no unused CSS classes are bleeding into the final build. Tailwind v4 handles this well, but custom complex variants could bypass automated purging.
4. **Database Query Profiling:** This audit focused on frontend delivery. A secondary audit should be run against the Drizzle ORM queries to ensure proper indexing, especially as the user base and prayer history logs grow.
