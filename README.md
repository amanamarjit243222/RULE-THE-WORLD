# 🌍 RULE THE WORLD — AdSense Ready

Your game is now fully prepared for Google AdSense compliance and live deployment.

## 🚀 Final AdSense Setup (CRITICAL)

The game has AdSense placeholders, but they **will not show real ads** until you add your specific Slot IDs.

1.  Log in to your [Google AdSense Dashboard](https://www.google.com/adsense/).
2.  Create **Display Ad Units** for:
    *   **Left Sidebar** (160x600 skyscraper)
    *   **Right Sidebar** (160x600 skyscraper)
    *   **Bottom Banner** (728x90 leaderboard)
3.  Open `index.html` and search for `NOTE for Publisher`.
4.  Replace the placeholder values in `data-ad-slot="..."` with your actual 10-digit Slot IDs.

## 🚢 Deployment Guide

AdSense requires a **publicly accessible live domain**.

### Option A: GitHub Pages (Recommended Free)
1.  Create a new repository on GitHub.
2.  Upload/Push all files in this directory to that repository.
3.  Go to **Settings** > **Pages**.
4.  Select `main` branch as the source and click **Save**.
5.  Your game will be live at `https://yourusername.github.io/your-repo-name/`.

### Option B: Netlify (Drag & Drop)
1.  Go to [Netlify.com](https://www.netlify.com/).
2.  Drag and drop this entire folder into the "Sites" upload area.
3.  Your game will be live instantly!

## 📜 Compliance Features Added
*   **Privacy Policy**: Fully expanded with AdSense-mandated language.
*   **Terms of Service**: New legal modal added.
*   **Cookie Consent**: High-visibility banner for GDPR/Policy compliance.
*   **Robots.txt & Meta**: Optimized for AdSense crawlers.

## 🛠 Development
To run locally for testing:
```bash
npm run dev
```
*(Requires Node.js)*
