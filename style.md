# Design style

Visual language only — colors, typography, and UI character you can copy elsewhere. No implementation or tooling details.

## Typography

- **Plus Jakarta Sans** — Latin interface type: headings, labels, buttons, body copy in English. Clean, modern geometric sans; use regular and semibold weights as needed for hierarchy.
- **Dangrek** — Khmer for display lines and prominent titles (single weight is enough for a consistent look).
- **Kantumruy Pro** — Khmer for supporting text and longer Khmer passages; pairs with the Latin sans for bilingual layouts.

**Hierarchy:** Short English subtitles may sit under Khmer titles in a smaller size and stronger accent color (see Color). Keep line length comfortable; avoid mixing more than two fonts in one block.

## Color

| Role | Hex | Notes |
|------|-----|--------|
| Brand primary | `#00518D` | Main brand blue — primary actions, key links, important icons, header accents. |
| Accent | `#EA1D24` | Strong secondary emphasis (e.g. English line under Khmer title, alerts that need attention without being errors). |

**Light surfaces:** White and near-white backgrounds; text is a cool dark blue-gray, not pure black. Borders and dividers are light neutral grays.

**Dark surfaces:** Deep cool gray / blue-gray background; light text; borders slightly visible but subdued. Primary fills read as light-on-dark in inverted contexts (high contrast chips, pills).

**Semantic feel:** Destructive / error states use a clear red tone. Success and warning should stay distinct from brand blue and accent red.

**Supporting palette (data and charts):** Use a small set of distinct hues for charts, tags, and legends so they are readable next to brand blue — e.g. teal, amber, violet, rose — not all variations of the same blue.

## Shape

- **Corners:** Avoid sharp 90° everywhere; avoid fully pill-shaped unless it is a single primary CTA. Use the **sm / md / lg / xl** radius steps in **Sizing** below.
- **Shadows:** Soft and low — cards lift slightly; avoid heavy drop shadows.

## Sizing

### Type scale (text)

| Name | Typical use | Role |
|------|-------------|------|
| **xs** | Captions, badges, tooltips, dense table meta | Smallest readable UI text |
| **sm** | Secondary body, helper text, many form labels | One step below primary body |
| **base** | Default body and most form fields | Primary reading size |
| **lg** | Section intros, emphasized inline | Slightly prominent |
| **xl / 2xl** | Page titles, empty-state headlines | Use sparingly for clear hierarchy |

Use at most **three** distinct text sizes in one viewport region to avoid noise.

### Control scale (buttons, inputs, similar controls)

| Name | Approx. height | Intent |
|------|----------------|--------|
| **xs** | ~24px | Dense toolbars, table row actions |
| **sm** | ~32px | Compact forms, secondary actions |
| **default** | ~36px | Standard primary actions |
| **lg** | ~40px | Hero calls-to-action, sign-in primary |

**Icon-only controls:** match the touch target to the same scale — **small** (~24px), **medium** (~32–36px), **large** (~40px) — with the glyph slightly smaller than the hit area.

### Corner radius scale

Base reference is **~10px**. Step down for nested or dense pieces, step up for outer shells:

- **sm** — pills, chips, tight inner elements (~6px effective)
- **md** — fields and compact controls (~8px)
- **lg** — default cards and standard controls (~10px)
- **xl** — large cards, inset shells (~14px)

### Spacing rhythm

Think in a **4px grid**: **tight** spacing between a label and its field; **comfortable** gaps between form groups; **section** gaps between major blocks. Consistent rhythm matters more than one-off pixel tweaks.

## Icons

- **Stroke** icons, single weight, simple geometry — match the weight of body text at the size used. Prefer outline style over filled for chrome; filled only for small status or toggles if needed.

## Motion

- Short transitions (roughly **150–250ms**) for hover and open/close. Easing ease-out or similar; no bouncy or playful overshoot in core admin flows.

## Layout and density

- Comfortable **admin density**: enough padding in cards and tables; avoid cramming. Side navigation and top bar align to a clear grid; main content has a readable max width where forms are long.

## Focus and accessibility

- **Keyboard focus** should always be visible: a soft ring or border in the theme’s ring color, not a harsh browser default only on some controls.
- **Invalid fields** pair border and ring in a destructive-tinted treatment so errors are obvious without relying on color alone (support copy or icons where possible).

## Elevation and surfaces

- **Tiers:** Default page background → slightly raised **cards** and panels → **floating** layers (menus, dialogs) with a bit more shadow and clear edges.
- **Inputs** sit on the base or card surface with a light border; **focus** lifts emphasis with ring, not a thick outline.

## Feedback

- **Toasts:** Short, non-blocking messages; stack sparingly. Success / error / warning should be visually distinct.
- **Loading:** Prefer **skeleton** blocks (muted pulse) for structure; use spinners only for small inline actions or buttons.

## Scrollbars (optional)

- Where custom scroll areas are used: **thin** track, **rounded** thumb, muted neutrals that match light or dark mode — not high-contrast stripes.

## Immersive / full-bleed views

- Some flows (e.g. proctor or exam) may use a **full brand-colored** surface (`#00518D` or similar) with light text and high-contrast countdown or status — keep that pattern for focused modes only, not the whole admin shell.

## Micro-typography in data UI

- **Micro-labels** (filters, tabs, badges): small caps or uppercase with slight **letter-spacing** is fine; keep readable size on mobile.
- **Numbers** in tables and timers: **tabular** alignment where columns of numbers appear.
