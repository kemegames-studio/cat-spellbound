# 🐱✨ Cat Spellbound

> **Magic. Mischief. Meowgic!**

A premium magical puzzle adventure game built with Phaser 3, TypeScript, and Vite.

---

## 🎮 Gameplay

Cat Spellbound is a **spell-crafting match puzzle** where your wizard cat companion reacts to every combo and helps you cast devastating magical abilities.

### Core Mechanics
- **Match & Cast** — Match 3+ tiles to charge spell energy (Stars → Light, Potions → Mana, Gems → Arcane)
- **Spell Fusion** — Combine charged energies to unlock unique spells: Lightning Storm, Healing Burst, Portal Vortex
- **Living Board** — Portals teleport tiles, cursed cells spread corruption, sleeping cats block paths, magic books transform tiles
- **Cat Companion** — Your wizard cat reacts emotionally to combos, celebrates victories, and casts bonus spells

### Power-Ups
- 🌈 Rainbow Potion — Clears all tiles of a selected color
- ☄️ Meteor Spell — Destroys a 3×3 zone with explosive impact
- 🐱 Cat Summon — Summons a wave of magical kittens across the board
- 🌀 Portal Explosion — Opens rifts that teleport matched tiles to the top

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | Phaser 3.80 |
| Language | TypeScript 5 |
| Bundler | Vite 5 |
| Target | Mobile-first browser |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server (opens at localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── main.ts                  # Game bootstrap
├── config/
│   ├── GameConfig.ts        # Phaser configuration
│   └── Constants.ts         # Game-wide constants & palette
├── scenes/
│   ├── BootScene.ts         # Initial boot & texture generation
│   ├── PreloadScene.ts      # Asset preloading with progress bar
│   ├── HomeScene.ts         # Main menu / home screen
│   ├── LevelSelectScene.ts  # Magical level map
│   ├── GameScene.ts         # Core puzzle gameplay
│   └── VictoryScene.ts      # Level complete screen
├── game/
│   ├── board/
│   │   ├── TileTypes.ts     # Tile definitions & energy types
│   │   ├── Tile.ts          # Tile game object with animations
│   │   └── Board.ts         # Board logic, matching, gravity
│   ├── spells/
│   │   ├── SpellTypes.ts    # Spell definitions
│   │   └── SpellSystem.ts   # Spell charging & fusion system
│   ├── effects/
│   │   └── EffectsManager.ts # Particles, screen shake, trails
│   └── companion/
│       └── CatCompanion.ts  # Animated wizard cat companion
└── ui/
    ├── HUD.ts               # Gameplay HUD (moves, score, spells)
    └── PauseMenu.ts         # Pause overlay
```

---

## 🎨 Visual Design

- **Palette**: Deep purple `#1a0a3a` · Gold `#ffd700` · Mana violet `#7b2fff` · Green glow `#00ff88`
- **Style**: Premium casual mobile — cozy magical atmosphere
- **Mascot**: Wizard cat in blue robe with star wand
- **Tagline**: *Magic. Mischief. Meowgic!*

---

## 📱 Mobile Optimizations

- Responsive canvas scaling (letterbox)
- Touch-first input (swipe & tap)
- 60 FPS target with GPU particle batching
- Safe area insets for notched devices

---

*Built with ❤️ and ✨ magic*
