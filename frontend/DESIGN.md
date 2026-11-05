# SIIP design system: "Bridge", charcoal and orange

The approved direction: logo charcoal and orange, warm off-white surfaces, and a light grey band for breathing room. It aims to feel trustworthy and hopeful, with a confident Nigerian character. Blue appears only inside the SkillzBridge logo itself, never in the UI.

All values below are CSS variables in [app/globals.css](app/globals.css), exposed to Tailwind as utilities (`bg-primary`, `text-muted-foreground`, `rounded-xl`…). **Screens use tokens only.** Never use raw hex values or one-off spacing.

## Colour

| Token                                 | Light                           | Dark              | Use                                                                                       |
| ------------------------------------- | ------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `primary`                             | #C94F08 (orange-600)            | #E8650C           | Main buttons and active states. White text in light mode (4.6:1); dark text in dark mode. |
| `brand`                               | #E8650C (logo orange)           | #FF8A3D           | Large fills and highlights, always with dark text                                         |
| `brand-text`                          | #A8460A                         | #FF8A3D           | Orange text and links on light surfaces (5.5:1)                                           |
| `secondary`                           | #1E2024 (charcoal-900)          | #EEF0F2           | Secondary buttons, completed steps, dark tiles                                            |
| `background`                          | #F7F7F6                         | #141518           | Page                                                                                      |
| `surface`                             | #FFFFFF                         | #1E2024           | Cards, inputs                                                                             |
| `surface-muted`                       | #EEEFF0                         | #2A2D32           | The light grey band, subtle fills, table heads                                            |
| `foreground` / `muted-foreground`     | #1E2024 / #5E636B               | #EEF0F2 / #A0A6AE | Text (16:1 and 5.6:1)                                                                     |
| `success` `warning` `danger` `info`   | #1F7A3D #A45C00 #B42318 #475467 | lighter variants  | Status, always paired with an icon or text                                                |
| `night` `night-2` `charcoal` `orange` | fixed                           | fixed             | Marketing surfaces that stay dark or orange in both themes                                |

Every text/background pair passes WCAG AA in both themes.

## Type

- **Display:** Lexend, 600, letter-spacing −0.025em to −0.04em. A rounded geometric face that echoes the logo's wordmark.
- **Text:** Source Sans 3, 400/600. Body text is 16px minimum (15px only for dense table cells and secondary lines).
- **Scale:** 13 · 15 · 16 · 17 · 20 · 24 · 28 · 34 · 44 · 60 · 92 px (hero).
- **Labels:** sentence case. Never small tracked capitals. Use tabular figures for numbers and timers.

## Shape, depth, spacing

- **Radius:** `sm` 8 · `md` 12 (inputs) · `lg` 18 · `xl` 28 (cards) · `2xl` 40 (hero bands). Buttons are pill-shaped.
- **Shadows:** `shadow-sm` (cards), `shadow-md` (raised), `shadow-lg` (overlays, floating cards). They are soft and warm-tinted in light mode, and deeper in dark mode.
- **Spacing:** Tailwind's 4px scale. Page gutters are 16/24/32px. Cards use 20–24px padding.
- **Touch targets:** at least 44px. Inputs are 48px tall.

## Motion (emil-design-eng rules)

- **Easing:** `--ease-out` cubic-bezier(.23,1,.32,1) for entering and UI feedback; `--ease-in-out` for movement on screen; `--ease-drawer` for sheets.
- **Duration:** UI animations take 150–250ms. Buttons press down to `scale(.97)`. Overlays enter at about 220ms and exit faster.
- **What animates:** only `transform` and `opacity`. Nothing scales up from 0.
- **Hover:** hover effects are gated to devices with a mouse.
- **Reduced motion:** honoured everywhere. The command menu (Ctrl/Cmd K) has no animation because it's used many times a day.
- **Landing page:** word-by-word headline reveal, a 3D card arc that follows the pointer, a sentence that lights up word by word on scroll, a fixed phone that changes screen as the steps scroll past, and a tilting certificate. All of it is visible without JavaScript.

## Components ([src/components/ui](src/components/ui))

- **Button:** variants `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`; sizes `sm`, `md`, `lg`, `icon`; supports `asChild` and `loading`.
- **Form controls:** `Input`, `Textarea`, `Select` (native, best on Android), `Checkbox`, `Switch`, `RadioCard`, plus `Field`, which connects the label, hint and error with ARIA.
- **Display:** `Card`, `Badge`, `StatusPill` (one map per backend enum, in `lib/labels.ts`), `Avatar`, `Progress`, `Skeleton`, `ListSkeleton`, `EmptyState`, `ErrorState`, `NoAccess`, `PageHeader` (with breadcrumbs), `StatCard`.
- **Overlays:** `Dialog`, `SheetContent` (slides up from the bottom on phones, in from the right on desktop), `ConfirmDialog` (destructive or irreversible actions only), `DropdownMenu`, `Tabs`, `Tooltip`.
- **DataTable:** TanStack Table with sorting, search, filter slots, row selection with bulk actions, column visibility, CSV export and pagination, plus loading, empty and error states.

## Do and don't

| Do                                                                | Don't                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| One primary action per screen                                     | Two orange buttons side by side                                     |
| Orange for "do this now" and the current step; charcoal for done  | Orange as decoration or for body text on light backgrounds          |
| White text on `primary` in light mode; dark text on `brand` fills | White text on logo orange (fails at 3.3:1)                          |
| Pair status colour with an icon or label                          | Colour as the only signal                                           |
| Skeletons for loading                                             | Spinners for whole pages                                            |
| Placeholder photo slots clearly labelled                          | Stock "team high-five" photos, invented stats, fake logos or quotes |
| Cards on the page background                                      | Cards inside cards                                                  |
