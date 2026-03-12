# Remote Content Creator – Landing Page

High-conversion landing page for a **Remote Content Creator / Live Stream Host** role. Built with Tailwind CSS, Creator Economy aesthetic (TikTok/social edge), Bento grid, and glassmorphism sidebar.

## Quick start

Serve the **`public`** folder so that `/images/` resolves to `public/images/`:

```bash
npx serve public
```

Then open the URL shown (e.g. http://localhost:3000). If your server uses the project root instead, set its document root to `public`, or move `index.html` into `public/` and serve that folder.

## Images

Place your assets in **`public/images/`** with these names:

| File | Use |
|------|-----|
| `hero-creator.jpg` | Large vertical (phone-style) portrait in Bento grid |
| `lifestyle-1.jpg` | Small square in Bento grid |
| `lifestyle-2.jpg` | Small square in Bento grid |
| `studio-setup.jpg` | Small square in Bento grid |

Recommended: hero portrait in 9:16, squares in 1:1. If a file is missing, the Bento cells will show as empty (background only).

## Stack

- **HTML** – single-page structure
- **Tailwind CSS** – via CDN (no build step)
- **Font** – Outfit (Google Fonts)
- **Accent** – Soft periwinkle `#8A9BFF`

## Layout overview

- **Hero:** Centered headline, “Verified Remote” badge, subtle gradient.
- **Bento grid:** One tall vertical slot + 3 smaller squares; images from `public/images/`.
- **Role breakdown:** 2-column on desktop – left: icon-driven list (Live Streaming, Short-form Video, Community Engagement); right: sticky glassmorphism card (Salary, Start Date, Submit Portfolio).
- **Social proof:** Horizontal marquee with TikTok, Instagram, YouTube, Twitch.
- **Mobile:** Sidebar (Apply card) appears below the hero and above the long role text so the CTA is visible early.
