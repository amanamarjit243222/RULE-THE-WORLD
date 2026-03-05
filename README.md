# 🌍 RULE THE WORLD: 2029 Geopolitical Simulator

![JS Tests](https://github.com/amanamarjit243222/RULE-THE-WORLD/actions/workflows/js-tests.yml/badge.svg)

### 🚀 **[Live Demo: Play the Geopolitical Strategy Simulator](https://ruletheworldmadebyaaj.netlify.app/)**

![In-Game Preview](assets/game_screenshot.png)

## 🎯 Strategic Value: The "Why"
In a world of generic strategy games, **RULE THE WORLD** stands out as a hyper-realistic lens into the near future.
 Set in 2029, it challenges players to navigate the complex, high-stakes reality of modern geopolitics—where a single trade agreement or military skirmish can shift the global balance of power.

## 👥 Who This Is For
- **Agencies & Creative Firms**: Building interactive, data-driven brand experiences or gamified marketing campaigns.
- **Educational Tech (EdTech)**: Prototyping strategic thinking tools and regional risk training modules.
- **Consulting Firms**: Demonstrating complex state management and interactive situational simulations.

## ✨ Key Features
- **Deep Geopolitical Systems**: Manage resource extraction, military doctrine, and bilateral diplomacy.
- **2029 Scenario Engine**: Experience procedurally influenced events based on current global trends.
- **Immersive Strategic UI**: Designed for high-density information management without sacrificing aesthetic polish.

## 🏗️ Code Architecture

```
RULE-THE-WORLD/
├── index.html               # Game shell & UI layout
├── package.json             # Dev dependencies & scripts
├── css/                     # Modular stylesheets
├── assets/                  # Images, flags, icons
├── src/
│   ├── audio/               # Ambient audio & SFX manager
│   ├── config/
│   │   └── db.js            # Game data: countries, factions, events
│   ├── map/                 # SVG map rendering & click handlers
│   ├── services/
│   │   ├── engine.js        # Core simulation loop & event system
│   │   ├── state.js         # Global game state & DOM helpers
│   │   └── cloud.js         # Save/load & leaderboard integration
│   └── ui/                  # HUD components & modal controllers
└── tests/
    └── game-logic.test.js   # Unit tests for core game logic (Jest)
```

## 🛠️ Tech Stack
- **Engine**: Vanilla JavaScript (Custom State Management & Simulation Loop)
- **Frontend**: HTML5, CSS3 (Modern Flex/Grid Architecture)
- **Testing**: Jest
- **Deployment**: Netlify

## 🚀 Local Setup

```bash
git clone https://github.com/amanamarjit243222/RULE-THE-WORLD.git
cd RULE-THE-WORLD

# Install dev tools (jest)
npm install

# Start local server
npm dev
# - or -
python -m http.server 8000
```

## 🧪 Running Tests

```bash
npm test
```

Tests cover the pure game logic functions (no browser required):
- **Initial State** — Validates game starts with correct defaults (year 2029, 22% tax, 0 tension)
- **Approval Rating** — Tests demographic average calculation
- **Quarter Labels** — Validates date-to-quarter-label conversion

## 🌐 Deployment

This project is a static site. Deploy in seconds:

**Netlify (Recommended):**
1. Go to [netlify.com](https://netlify.com) → "New Site from Git"
2. Connect your GitHub repository
3. Set Build Command: (leave empty) | Publish dir: `./`
4. Click Deploy

**GitHub Pages:**
```bash
# Push to GitHub, then enable Pages in Settings → Pages → Deploy from main branch
npm run deploy  # prints instructions
```

## 📸 In-Game Preview
![Gameplay Screenshot](assets/game_screenshot.png)

