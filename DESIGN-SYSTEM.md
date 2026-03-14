# The Prism Palette — Design System

**Tagline:** High-Gloss Tactility · 90% White base with chromatic depth · "Beautiful" agency feel

This document is the single source of truth for the Content Streamers / Vantage.Content visual language. Use it when adding new pages or refreshing the look.

---

## 1. Expanded Color System: "The Prism Palette"

We keep a ~90% White base but introduce chromatic depth.

| Variable | Value | Name / Use |
|----------|--------|------------|
| `--color-base` | `#FFFFFF` | **Gallery White** — page foundation |
| `--color-ink` | `#080808` | **Deep Onyx** — razor-sharp typography |
| `--accent-iris` | `linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 100%)` | **Sky-Glass** — faint cool-blue silver for hover states |
| `--accent-prism` | `linear-gradient(90deg, #FAD0C4 0%, #FFD1FF 100%)` | **Champagne-Quartz** — barely-there warm glow for active elements |
| `--color-glass` | `rgba(255, 255, 255, 0.4)` | Base for all blurred overlays (glass trays, cards) |

```css
:root {
  --color-base: #FFFFFF;
  --color-ink: #080808;
  --accent-iris: linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 100%);
  --accent-prism: linear-gradient(90deg, #FAD0C4 0%, #FFD1FF 100%);
  --color-glass: rgba(255, 255, 255, 0.4);
  --gutter: 48px;
  --max-w: 1440px;
  --ease-liquid: cubic-bezier(0.25, 1, 0.5, 1);
}
```

---

## 2. The Texture System: "High-Gloss Tactility"

### Refractive borders

Instead of a solid grey line, use a linear gradient border so boxes look like they have a light source on the edge:

- Border: `linear-gradient(to bottom right, #E5E5E5, #FFFFFF)` (or similar: grey to white so one edge catches light).

### The "Vogue" grain

- Micro-noise texture over the entire site.
- Opacity: **0.02** (very subtle).
- Gives premium paper/film texture and prevents flat white.

```css
.grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.02;
  background-image: url("data:image/svg+xml,...fractalNoise...");
}
```

### Caustic lighting

- Large, ultra-soft "blobs" of the prism colors (Sky-Glass and Champagne-Quartz).
- Positioned at the **very edges** of the screen.
- Blur: **700px** so they look like light reflecting off a nearby window.
- Use as pseudo-elements or fixed divs with low opacity.

---

## 3. Deep-Dive Design Components

### I. The "Glass-Tray" Navigation

The menu should feel like a **floating piece of polished acrylic**, not a bar.

- **Style:** `backdrop-filter: blur(25px) saturate(150%);`
- **Border:** `1px solid rgba(255, 255, 255, 0.5);`
- **Interaction:** On link hover, a tiny **Prism dot** appears beneath the text, glowing softly (e.g. small gradient circle under the link).

### II. The "Studio-Metric" Grid (Technical Depth)

- **Etched numbers:** For every section use a massive **200pt Inter number** in the background (01, 02, 03).
- **Opacity:** 0.03 — barely visible, like a watermark on a banknote.
- **Metric styling:** Data points (e.g. "Average CCV") in a **sharp black Monospaced** font; the **unit** (e.g. "K", "%") in the **Champagne-Quartz** gradient.

### III. "Shadowless" Depth (Inner Glow)

- No traditional shadows.
- Use **inner glows**: on bento boxes, add a slight **inset white glow** on the **top and left** edges.
- Creates the "Gloss" effect seen on high-end hardware — screen looks like a physical object.

```css
.gloss-box {
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.8);
  /* optional: subtle bottom/right dark for edge */
}
```

---

## 4. Typography: Single Font (Inter)

One font only — **Inter** — for all UI and content. Hierarchy is created by weight and size.

### Headlines

- **Font:** Inter **Semi-Bold** (600) or **Medium** (500).
- **Size:** Large for hero (e.g. clamp(2.5rem, 6vw, 4.5rem)); 2–3rem for section titles.
- Optional: `background-clip: text` with **Sky-Glass** gradient for hero headline.

### Technical meta / labels

- **Font:** Inter **Medium** (500).
- **Treatment:** `letter-spacing: 0.25em`. Color: `#080808`.
- **Usage:** "SYSTEM STATUS: OPTIMIZED", section labels, nav.

### Body

- Inter **Regular** (400), 15px, line-height 1.6, color `--color-ink`.

**Google Fonts import (Inter only):**

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
```

---

## 5. Motion Identity: "Fluid Precision"

- **The "Iris" transition:** When moving between sections, images expand slightly from the center (mimicking a camera lens opening).
- **Magnetic interaction:** Buttons have a "magnetic" pull: when the cursor is within ~20px, the button subtly shifts toward the mouse.
- **Progress scroll:** Instead of a default scrollbar, a thin **1px horizontal line** at the **very top** of the screen fills with the **Prism Gradient** as the user scrolls down the page.

---

## 6. Layout Example: "Aura & Architecture" Section

A mid-page section that defines the brand’s beauty.

- **Left (60%):** Portrait of a creator; edges of the photo **feather** (fade) into the white background using a feathered mask.
- **Right (40%):** Vertical column of **technical specs** in **Monospace** (e.g. metrics, specs).
- **Middle overlay:** A **floating, blurred glass card** with "Brand Vision" text. Text is black; the card refracts / shows the colors of the photo underneath (glass overlay).

---

## 7. Reference Files

- **Live demo:** `public/design-system-demo.html` — Prism Palette & High-Gloss component showcase.
- **Applied on site:** `index.html`, `public/index.html`, `thank-you.html`, `public/thank-you.html`.

When in doubt, open the demo page or this file and reuse the tokens and patterns above.
