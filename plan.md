1. **Understand Problem:** Mobile users might not realize the Qaza tracking cards in `src/components/QazaClient.tsx` are interactive and can be tapped to open the detail sheet. Currently, they look like static read-only cards showing numbers. The system memory suggests adding a visual affordance like `ChevronRight` to indicate interactivity.
2. **Review QazaClient.tsx card:** The card currently has a `grid grid-cols-2` layout. The cards are stacked flex columns centered.
   We can add a `ChevronRight` icon to the card, maybe in the top right or just alongside the title. A subtle top-right icon is common for "opens detailed sheet" interactions on mobile.
3. **Plan:**
   - Modify `src/components/QazaClient.tsx`.
   - Add `import { ChevronRight } from "lucide-react"`.
   - In the `Card` component loop, add a `relative` class.
   - Add `<ChevronRight size={16} className="absolute top-3 right-3 text-muted-foreground/50" />`.
   - Ensure the card has `relative` positioning.
4. **Pre-commit:** Run standard verification checks (`npm run lint`, `npm run build`) and mobile-responsive check logic.
