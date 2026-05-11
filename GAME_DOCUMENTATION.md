# Cat Spellbound — Complete Game Documentation

> **Engine:** Phaser 3.90 · **Language:** TypeScript 5 · **Build:** Vite 5
> **Platform:** Android (Capacitor) · **Canvas:** 390 × 844 px

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Architecture & Scene Flow](#2-architecture--scene-flow)
3. [Configuration & Constants](#3-configuration--constants)
4. [Scenes (All Screens)](#4-scenes-all-screens)
5. [The Game Board](#5-the-game-board)
6. [Tile System](#6-tile-system)
7. [Match Logic](#7-match-logic)
8. [Gravity & Refill System](#8-gravity--refill-system)
9. [Score & Combo System](#9-score--combo-system)
10. [Energy & Spell System](#10-energy--spell-system)
11. [Special Cells & Mechanics](#11-special-cells--mechanics)
12. [Cat Companion](#12-cat-companion)
13. [Effects Manager](#13-effects-manager)
14. [HUD (Heads-Up Display)](#14-hud-heads-up-display)
15. [Pause Menu](#15-pause-menu)
16. [Bottom Navigation](#16-bottom-navigation)
17. [Win & Lose Conditions](#17-win--lose-conditions)
18. [Victory Scene](#18-victory-scene)
19. [Level Definitions](#19-level-definitions)
20. [Asset List](#20-asset-list)
21. [Depth Layers (Z-Order)](#21-depth-layers-z-order)
22. [Animation Timings](#22-animation-timings)
23. [Full Game Flow Diagram](#23-full-game-flow-diagram)

---

## 1. Game Overview

**Cat Spellbound** is a mobile match-3 puzzle game set in a magical cat wizard universe. The player swaps coloured tiles on a 7×8 grid to create matches of 3 or more. Matches charge energy bars that fuel powerful spells. Each level has a move limit, a score target, and a tile-collection objective. The player wins by meeting all objectives before running out of moves.

**Core Loop:**
```
Swap tiles → Create matches → Earn points + energy → Cast spells → Meet objectives → Win
```

---

## 2. Architecture & Scene Flow

### Scene Lifecycle
```
BootScene
  └─► KemeSplashScene  (Keme brand splash, 2.5s)
        └─► CatSplashScene  (Cat Spellbound title splash, 3.0s)
              └─► PreloadScene  (loads all assets + shows progress bar)
                    └─► HomeScene  (main menu with level map)
                          └─► GameScene  (core gameplay)
                                ├─► GameScene  (retry)
                                └─► VictoryScene  (win screen)
                                      ├─► GameScene (next level)
                                      └─► GameScene (replay)
```

### File Map
```
src/
  config/
    Constants.ts      — All game-wide constants, level data, type definitions
    GameConfig.ts     — Phaser game configuration
  scenes/
    BootScene.ts      — First scene, minimal setup
    KemeSplashScene.ts— Brand splash screen
    CatSplashScene.ts — Game title splash screen
    PreloadScene.ts   — Asset loading + progress bar
    HomeScene.ts      — Home/menu screen
    GameScene.ts      — Core gameplay orchestrator
    VictoryScene.ts   — Win screen with fireworks
  game/
    board/
      Board.ts        — Grid logic, swap, match, gravity
      Tile.ts         — Individual tile visual + state
      TileTypes.ts    — Tile type definitions + MatchGroup interface
    spells/
      SpellSystem.ts  — Energy tracking + spell fusion logic
      SpellTypes.ts   — Spell definitions (name, icon, effect, energy cost)
    effects/
      EffectsManager.ts — All visual effects (particles, text popups, shakes)
    companion/
      CatCompanion.ts — Wizard cat character, moods, speech bubbles
  ui/
    HUD.ts            — In-game heads-up display
    BottomNav.ts      — Persistent bottom navigation bar
    PauseMenu.ts      — Pause overlay with Resume/Restart/Quit
  utils/
    GraphicsUtils.ts  — Reusable drawing helpers (star shapes, etc.)
  main.ts             — Entry point, creates Phaser.Game
```

---

## 3. Configuration & Constants

**File:** `src/config/Constants.ts`

### Canvas
| Constant | Value | Description |
|---|---|---|
| `GAME_WIDTH` | 390 | Canvas width in pixels |
| `GAME_HEIGHT` | 844 | Canvas height in pixels |

### Board Layout
| Constant | Value | Description |
|---|---|---|
| `BOARD_COLS` | 7 | Number of tile columns |
| `BOARD_ROWS` | 8 | Number of tile rows |
| `TILE_SIZE` | 50 px | Width and height of each tile |
| `TILE_GAP` | 4 px | Space between tiles |
| `BOARD_OFFSET_X` | ~11 px | Left edge of board (auto-centred) |
| `BOARD_OFFSET_Y` | 220 px | Top edge of board (below HUD) |
| `MATCH_MIN` | 3 | Minimum tiles in a valid match |

The formula for the board's pixel bounds:
- **Right edge:** `BOARD_OFFSET_X + 7 × (50+4) − 4 = 390 px`
- **Bottom edge:** `BOARD_OFFSET_Y + 8 × (50+4) − 4 = 648 px`

### Spell System
| Constant | Value | Description |
|---|---|---|
| `SPELL_CHARGE_NEEDED` | 12 | Energy points required per energy type to trigger fusion |

### Tile → Energy Mapping
| Tile Type | Energy Type |
|---|---|
| Star | Light |
| Potion | Mana |
| Gem | Arcane |
| Book | Light |
| Crystal | Arcane |

### Spell Fusion Combinations
| Energy A | Energy B | Spell Produced |
|---|---|---|
| Light | Mana | Healing Burst |
| Mana | Arcane | Portal Vortex |
| Light | Arcane | Lightning Storm |

### Colour Palette
| Name | Hex | Usage |
|---|---|---|
| `bgDeep` | `#0a0418` | Deepest background |
| `bgMid` | `#1a0a3a` | Mid-tone purple background |
| `bgLight` | `#2d1b69` | Lighter purple panels |
| `purple` | `#4a1484` | Main purple accent |
| `purpleLight` | `#7b2fff` | Glows, borders |
| `gold` | `#ffd700` | Score, stars, selected tiles |
| `green` | `#00ff88` | Victory, healing, portals |
| `cyan` | `#00eeff` | Arcane energy, lightning |
| `pink` | `#ff44aa` | Crystal tiles, cat summon |

---

## 4. Scenes (All Screens)

### BootScene
Minimal first scene. Performs any early initialisation before handing off to the splash sequence.

---

### KemeSplashScene
- Displays the **Keme brand logo** full-screen.
- Matches page background (`#2c1654`) so letterbox gaps are invisible.
- Auto-advances to `CatSplashScene` after **~2.5 seconds**.

---

### CatSplashScene
- Displays the **Cat Spellbound title screen** full-screen.
- Waits a minimum of **3 seconds** to ensure the splash is always seen.
- Then starts `PreloadScene`.

---

### PreloadScene
Loads every game asset in the background while showing a progress bar.

**Assets loaded:**
- Images: `ui_home.jpg`, `ui_gameplay.jpg`, `ui_victory.png`, `splash.png`
- PNG icons: `tab_home`, `tab_store`, `tab_profile`, `tab_social`, `tab_rank`, `icon_coin_paw`, `icon_heart`, `ui_plus_icon`, `ui_holder`, `ui_green_circle_button`
- SVG icons: `icon_settings`, `icon_coin`, `icon_btn_plus`, and nav variants
- Particle textures: `particle_spark`, `particle_star`, `particle_orb`, `particle_flare`
- Tile images: `tile_star`, `tile_potion`, `tile_gem`, `tile_book`, `tile_crystal`
- Special tiles: `tile_sleeping_cat`, `tile_*_cursed` variants
- UI: `spell_slot`, `spell_slot_active`, `cat_wizard`

**Loading bar:** Shows percentage from 0→100% with a gold fill bar at the bottom of the screen.

After loading completes, transitions to `HomeScene`.

---

### HomeScene
The main menu. Uses `ui_home.jpg` as a full-screen background (all UI is baked into the image). Transparent hit zones are placed over every interactive element.

**Interactive zones:**

| Element | Action |
|---|---|
| Settings gear (top-left) | Visual feedback (placeholder) |
| Lives pill | Visual feedback (placeholder) |
| Lives "+" button | Visual feedback (placeholder) |
| Coins pill | Visual feedback (placeholder) |
| Coins "+" button | Visual feedback (placeholder) |
| **Play button** (large green oval) | Fades to `GameScene` with `levelId: 1` |
| Events button (bottom-left) | Visual feedback (placeholder) |
| Shop button (bottom-right) | Visual feedback (placeholder) |
| Home nav tab | Visual feedback (already on this screen) |
| Store nav tab | Visual feedback (placeholder) |
| Social nav tab | Visual feedback (placeholder) |
| Profile nav tab | Visual feedback (placeholder) |

All taps produce a white camera flash (`flash(120ms)`) as feedback. The Play button triggers a 260ms camera fade-out before scene transition.

---

### GameScene
The core gameplay screen. Orchestrates all game systems.

**Initialisation (`init`):**
Receives `{ levelId }` from the launching scene. Looks up the level config from `LEVELS[]` to set:
- `movesLeft` — number of swaps allowed
- `scoreTarget` — minimum score to win
- `objectives` — tile types to collect and how many

**`create()` order:**
1. Draw `ui_gameplay.jpg` background
2. Instantiate `EffectsManager`
3. Instantiate `CatCompanion`
4. Instantiate `SpellSystem`
5. Instantiate `Board` (with match/combo/cleared/stable callbacks)
6. Instantiate `HUD`
7. Instantiate `PauseMenu`
8. Draw board background panel + grid lines + corner runes
9. Draw bottom cover (solid bar hiding baked-image gap)
10. Place portal indicators
11. Start ambient particle effects
12. Add `BottomNav` with Home tab routed to `quitGame()`
13. Initial HUD update (moves, score, objectives)
14. Camera fade-in

---

### VictoryScene
Displays the win screen with the `ui_victory.png` background image.

**Features:**
- 10 sequential firework bursts (staggered 220ms apart) in 5 colours
- **Score count-up animation**: animates from 0 to final score over 40 steps × 30ms
- **Star pop-in**: particle burst at each earned star position (1–3 stars)
- Continuous upward particle fountain from the screen bottom
- **Next Level** button zone (y≈618) → `GameScene` with `levelId + 1` (capped at 12)
- **Replay** button zone (y≈672) → `GameScene` with same `levelId`

---

## 5. The Game Board

**File:** `src/game/board/Board.ts`

The board is a **7 columns × 8 rows** grid stored as `grid[row][col]`, a 2D array of `Tile | null`.

### Initialisation
On creation, `initGrid()` fills every cell with a randomly chosen tile type, using `safeRandomType()` to ensure no pre-existing matches of 3 appear at game start.

`safeRandomType(col, row)` works by:
1. Checking the two tiles to the left of the new cell.
2. Checking the two tiles above the new cell.
3. If both neighbours in a direction share the same type, that type is added to a **forbidden set**.
4. A random type is chosen from the remaining allowed types.

After the grid is filled, `setupSpecialCells()` places:
- **Portal pair** at (col=1, row=2) ↔ (col=5, row=6)
- **Cursed tiles** at (col=3, row=4) and (col=2, row=7)
- **Sleeping cat** at (col=6, row=1)

### Tile Selection & Swap
The board listens for `pointerdown` on each tile object.

**Selection flow:**
```
No tile selected → tap tile A → tile A is selected (gold ring appears, scale 1.12×)
  Tap tile A again → deselect
  Tap adjacent tile B → attempt swap
  Tap non-adjacent tile C → deselect A, select C
```

**Adjacent check:** Two tiles are adjacent if the absolute difference in their column OR row is exactly 1 (not diagonal).

### Swap Attempt
`trySwap(tileA, tileB)`:
1. Set `isProcessing = true` (blocks further taps).
2. Animate both tiles sliding to each other's position (`ANIM.tileSwap = 200ms`).
3. Update the grid array and tile grid positions immediately.
4. After 220ms, run `findAllMatches()`.
5. **If matches found:** call `processMatches()`.
6. **If no matches:** animate tiles sliding back, spawn invalid-swap indicator (red ✕ circle), set `isProcessing = false` after 220ms.

---

## 6. Tile System

**File:** `src/game/board/Tile.ts`

Each `Tile` is a `Phaser.GameObjects.Container` holding:
- **Glow circle** (18% alpha, colour-matched to tile type) — soft aura behind the tile
- **Base image** — the main tile PNG (e.g. `tile_star`)
- **Selection ring** — gold rounded rectangle (hidden by default, shown when selected)
- **Shine graphic** — white ellipse highlight (decorative)

### Tile Types & Colours
| Type | Colour | Energy |
|---|---|---|
| Star | Gold `#ffd700` | Light |
| Potion | Purple `#aa33ff` | Mana |
| Gem | Cyan `#00eeff` | Arcane |
| Book | Orange `#ff6644` | Light |
| Crystal | Pink `#ff44cc` | Arcane |

### Tile States
| State | Description |
|---|---|
| `isSelected` | Tile has been tapped, awaiting swap partner |
| `isMatched` | Tile is part of a match and is mid-destruction animation |
| `isFalling` | Tile is currently playing gravity fall animation |
| `cursed` | Tile has dark overlay, prevents matching (uses `_cursed` texture variant) |
| `sleeping` | Tile cannot be selected (sleeping cat obstacle) |

### Tile Animations
| Animation | Trigger | Details |
|---|---|---|
| **Spawn** | Board fill / refill | Drops from above with scale 0.5→1, alpha 0→1, `Back.easeOut`, 280ms |
| **Idle float** | After landing | Gentle ±3px vertical oscillation, 1800–2800ms, repeat forever |
| **Select** | On tap | Scale 1→1.12, `Back.easeOut`, 100ms |
| **Deselect** | On deselect/swap | Scale 1.12→1, `Power2`, 100ms |
| **Hover** | `pointerover` | Scale 1→1.06, `Power2`, 80ms |
| **Match destroy** | On match | Scale 1→1.4 + alpha 1→0, `Back.easeIn`, 180ms. Glow expands 1→3× |
| **Fall** | After match clears | `Bounce.easeOut` to new Y position, 280ms + delay per distance |
| **Land bounce** | After fall lands | Quick squash: scaleX 1.08, scaleY 0.93, 80ms yoyo |
| **Swap** | On swap attempt | Tweens to target position, `Power2.easeInOut`, 200ms |
| **Curse applied** | `applyCurse()` | Flickers alpha 0.75→1, repeats twice |

---

## 7. Match Logic

**Method:** `Board.findAllMatches()`

Scans the board in two passes:

**Horizontal pass:** For each row, left to right, finds runs of 3+ consecutive tiles of the same type.

**Vertical pass:** For each column, top to bottom, finds runs of 3+ consecutive tiles of the same type.

A `visited` Set prevents the same cell being counted in both a horizontal and vertical match. Each match is returned as a `MatchGroup`:

```typescript
interface MatchGroup {
  tiles: Array<{ col: number; row: number }>;
  type: TileType;       // which tile type matched
  size: number;         // total tiles in match
  isSpecial: boolean;   // true if size >= 4
  isMegaMatch: boolean; // true if size >= 5
}
```

### Match Processing
`processMatches(matches)`:
1. Increment `comboCount`.
2. For each tile in all matches:
   - Mark `tile.isMatched = true`
   - Calculate staggered destroy delay: `(col + row) × 48ms` — creates a wave effect
   - If the tile is adjacent to a portal cell → spawn portal teleport effect
   - Spawn match burst particle effect
   - Play tile match animation (scale-pop + fade-out)
   - Remove tile from grid on animation complete
3. Fire `callbacks.onMatch(group)` for each match group → triggers score calculation
4. Fire `callbacks.onTileCleared(type, count)` → updates objective tracking
5. If `comboCount > 1` → fire `callbacks.onCombo(comboCount)`
6. Call `spreadCurse()` (25% chance each cursed cell spreads to a random neighbour)
7. After all destroy animations finish → call `applyGravity()`
8. After gravity → scan for new matches
9. If new matches found → call `processMatches()` again (chain combo)
10. If no new matches → `isProcessing = false`, fire `callbacks.onBoardStable()`

### Special Match Rules
| Match Size | Classification | Extra Effect |
|---|---|---|
| 3 | Normal | Standard burst |
| 4+ | Special (`isSpecial: true`) | Extra star particles in burst |
| 5+ | Mega (`isMegaMatch: true`) | Even larger burst |

---

## 8. Gravity & Refill System

**Method:** `Board.applyGravity(onComplete)`

After tiles are destroyed, gravity pulls surviving tiles downward:

1. **Per column**, scan from bottom to top.
2. Track `writeRow` — the next empty slot from the bottom.
3. Any surviving (non-matched) tile that is above an empty slot falls down to `writeRow`.
4. The tile's grid position is updated and a fall animation plays.
5. After all existing tiles settle, empty slots at the **top** of each column are filled with new random tiles that fall in from above the board.

**Fall animation:** `Bounce.easeOut` — tiles bounce slightly on landing, giving a satisfying feel. Duration is `280ms + (fallDistance × 10ms)`. After landing, the idle float animation restarts.

**Refill source:** New tiles start at `y = BOARD_OFFSET_Y - (distance + 1) × (TILE_SIZE + TILE_GAP)` — above the visible board area, so they appear to fall in from off-screen.

---

## 9. Score & Combo System

### Base Score Calculation
Score is calculated in `GameScene.onMatch(group)`:

```
basePoints = group.size × 100
           × 1.5 (if size >= 4)
           × 2   (if size >= 5)

finalPoints = round(basePoints × comboMultiplier)
```

| Match Size | Base Points | Multipliers |
|---|---|---|
| 3 | 300 | ×1 |
| 4 | 600 | ×1.5 |
| 5 | 1,000 | ×1.5 × 2 = ×3 |
| 6 | 1,200 | ×1.5 × 2 |

### Combo Multiplier
Every time tiles clear and **new matches are found automatically** (cascade), `comboCount` increases.

```
comboMultiplier = 1 + comboCount × 0.3
```

| Combo | Multiplier |
|---|---|
| 1 (first match) | ×1.0 |
| 2 (cascade) | ×1.3 |
| 3 | ×1.6 |
| 4 | ×1.9 |
| 5 | ×2.2 |

The multiplier resets to ×1 when the board stabilises (no more cascades).

### Combo Announcements
Each combo level triggers a different text and screen effect:

| Combo | Text | Colour | Screen Effect |
|---|---|---|---|
| 2 | "COMBO!" | Gold | — |
| 3 | "AMAZING!" | Orange | Screen shake |
| 4 | "INCREDIBLE!" | Pink | Shake + gold flash |
| 5 | "MAGICAL!" | Green | Shake + gold flash |
| 6+ | "MEOWGIC!!!" | Cyan | Shake + gold flash |

Text floats upward and fades out over 900ms.

### Score Threshold for Stars
Stars are awarded at Victory based on score vs target:

| Score Ratio | Stars |
|---|---|
| < 1.0× target | ⭐ 1 star |
| ≥ 1.0× target | ⭐⭐ 2 stars |
| ≥ 1.5× target | ⭐⭐⭐ 3 stars |

---

## 10. Energy & Spell System

**Files:** `src/game/spells/SpellSystem.ts`, `src/game/spells/SpellTypes.ts`

### Energy Bars
There are three energy types, each with its own bar in the HUD:
- **Light** (gold) — charged by matching Stars and Books
- **Mana** (purple) — charged by matching Potions
- **Arcane** (cyan) — charged by matching Gems and Crystals

Each tile matched adds `matchSize` energy points to its corresponding bar. Maximum stored per type = `SPELL_CHARGE_NEEDED × 2 = 24`.

### Spell Fusion (Two-Energy Spells)
When two energy types **both reach 12 points**, they fuse into a spell:

| Spell | Energy A | Energy B | Effect |
|---|---|---|---|
| ⚡ Lightning Storm | Light (12) | Arcane (12) | Clears 2 random rows with jagged lightning bolts |
| 💚 Healing Burst | Light (12) | Mana (12) | Clears 3×3 area at board centre, removes curses |
| 🌀 Portal Vortex | Mana (12) | Arcane (12) | Clears all Gem and Crystal tiles from the board |

### Solo-Energy Spells (1.5× Charge)
When a **single energy type reaches 18 points** (1.5× the threshold):

| Spell | Energy Required | Effect |
|---|---|---|
| ☄️ Meteor Spell | Arcane (18) | Drops meteor on random position, blasts 3×3 zone |
| 🌈 Rainbow Potion | Light (18) | Clears all Star tiles from the board |
| 🐱 Cat Summon | Mana (18) | Clears tiles at 6 paw-print positions |

### How Spells Work
1. When a fusion threshold is met, `checkFusion()` runs automatically.
2. The energy cost is deducted immediately.
3. A `FusedSpell` object is created and added to `availableSpells[]`.
4. `onSpellReady(spell)` is fired → HUD adds the spell to a slot, Cat Companion reacts.
5. Notification text appears: `"✨ [Spell Name] READY!"` floating up and fading.
6. Player taps the spell slot in the HUD to cast.
7. `castSpell()` in GameScene:
   - Disables board interaction
   - Plays full spell-cast visual (particle burst + ripple rings + spell name text)
   - After 600ms, `executeSpell()` runs the effect
   - Board then runs gravity/refill and resumes interaction

### Spell Slot UI
The HUD has 3 spell slots at the bottom of the header (y≈182). Empty slots show a dim "Spell N" label. Active slots show the spell icon and name, scale-up on hover, and are tappable.

---

## 11. Special Cells & Mechanics

### Portal Cells
- **Positions:** (col=1, row=2) and (col=5, row=6) — always a linked pair.
- **Visual:** Pulsing green ring drawn over the tiles, animated scale 1.0↔1.15 every 1200ms.
- **Effect:** When a tile is matched adjacent to a portal cell (within 1 cell distance), a **portal teleport** effect fires — green particles + expanding ring.
- The tile is still destroyed normally; the effect is purely visual.

### Cursed Cells
- **Starting positions:** (col=3, row=4) and (col=2, row=7).
- **Visual:** Tile uses a `_cursed` texture variant (darker appearance), tile alpha is 0.75.
- **Gameplay:** Cursed tiles **cannot be matched** — they act as obstacles.
- **Spread mechanic:** After every match, each existing cursed cell has a **25% chance** to spread the curse to one random orthogonal neighbour (up/down/left/right). Curse only spreads to cells that are not already cursed.

### Sleeping Cat Tile
- **Starting position:** (col=6, row=1).
- **Visual:** Uses `tile_sleeping_cat` texture.
- **Gameplay:** The sleeping cat tile **cannot be selected or swapped**. Tapping it does nothing. It is skipped entirely by the input handler.
- The sleeping cat acts as a permanent blocker for that cell.

### Deadlock Detection
`Board.hasMoves()` checks every adjacent pair on the board by temporarily swapping them and running `findAllMatches()`. If no valid swap can produce a match, the board has no moves.

When a deadlock is detected after a move resolves:
1. Display "Reshuffling..." text.
2. Flash the screen with purple light.
3. *(Shuffle logic hook — full shuffle can be wired here.)*

---

## 12. Cat Companion

**File:** `src/game/companion/CatCompanion.ts`

A wizard cat character displayed at the bottom-right of the screen (`x=338, y=664`). Uses the `cat_wizard` image asset scaled to 52%.

### Moods & Messages
The companion reacts to gameplay events:

| Mood | Trigger | Example Messages | Animation |
|---|---|---|---|
| `idle` | Default state | "Tap to swap!", "Make a match!", "Magic awaits..." | Gentle float (±8px, 1800ms cycle) |
| `excited` | Match scored, combo | "COMBO!", "Purrfect!", "Meowgic!", "AMAZING!" | Jump-squash chain (4 tweens), 6 gold sparkle bursts |
| `casting` | Spell activated | "SPELL CAST!", "MEOWGIC!!!", "⚡ UNLEASH!" | Lean forward + scale 1.2×, wand flash circle |
| `celebrating` | Level won | "YOU WIN! 🎉", "PURRFECT!", "🏆 BRILLIANT!" | 4 bounces (−30px), 150ms each |
| `worried` | ≤5 moves remaining | "Only a few moves!", "Watch out!", "Hmm..." | Rapid horizontal shake (5 reps, 80ms each) |

### Speech Bubble
- White rounded rectangle with a tail pointer.
- Appears with `Back.easeOut` scale 0.7→1 over 200ms.
- Disappears after 2000ms with fade-out over 300ms.
- Text is chosen randomly from the mood's message array.

### Ambient Sparkles
Every 900ms during idle mood, a small 4-pointed gold star spawns near the cat, floats upward 25px, and fades out over 600ms.

### Mood Reset
After any non-idle mood animation, the companion automatically returns to `idle` after 2500ms.

---

## 13. Effects Manager

**File:** `src/game/effects/EffectsManager.ts`

Centralised class for all visual effects. All effects are one-shot (they auto-destroy after playing).

| Method | Trigger | Description |
|---|---|---|
| `spawnMatchBurst` | Tile matched | Spark particles (8 + matchSize×4), 400ms. For size 4+: extra gold star particles |
| `spawnSelectBurst` | Tile tapped | Small orb burst (8 particles), 350ms |
| `spawnInvalidSwap` | No-match swap | Red ✕ circle that expands and fades |
| `spawnPortalTeleport` | Match near portal | Green/teal orbs + expanding ring, 800ms |
| `screenShake` | Combo 3+, spells, meteor | Camera shake, configurable intensity + duration |
| `screenFlash` | Combo 4+, spells, victory | Camera flash in specified colour |
| `spawnComboText` | Combo triggered | Floating bold text (size scales with combo), ring burst, 900ms |
| `spawnSpellCast` | Spell cast | 20 flare particles + 3 ripple rings + spell name text, with shake+flash |
| `spawnScorePopup` | Tile matched | "+N" gold text floating up 55px, 700ms |
| `spawnMeteorEffect` | Meteor spell | Animated meteor drops from off-screen, trail particles, impact burst + shake |
| `spawnLightningEffect` | Lightning Storm | Jagged multi-segment line in cyan, fades 350ms |
| `spawnVictoryBurst` | Level won | 5 multi-colour particle bursts, screen shake + gold flash |

---

## 14. HUD (Heads-Up Display)

**File:** `src/ui/HUD.ts`

The HUD occupies the full **top 220px** of the game canvas (matching `BOARD_OFFSET_Y`), with a solid dark background (`#0d0525` at 97% opacity) that completely covers any background image content above the board.

### Layout (top-to-bottom)

```
┌─────────────────────────────────────────────┐  y=0
│  ⏸          Level N              [SCORE]    │  Row 1  (y=0–50)
├─────────────────────────────────────────────┤  y=50
│  Obj: X/N       [ MOVES: 22 ]               │  Row 2  (y=50–108)
├─────────────────────────────────────────────┤  y=108
│  ⭐ Light ▓▓░░   🔮 Mana ▓░░░   💎 Arc ▓▓▓░ │  Row 3  (y=108–148)
├─────────────────────────────────────────────┤  y=148
│   [Spell 1]        [Spell 2]      [Spell 3] │  Row 4  (y=148–218)
└─────────────────────────────────────────────┘  y=220 (board starts)
```

### Row Details

**Row 1 — Controls**
- **Pause button (⏸):** Position (26, 26). Interactive. Scales to 1.15× on hover. Calls `onPause()`.
- **Level label:** Centred at (195, 25). Shows "Level N" in bold Georgia font, purple-white colour.
- **Score box:** Right-aligned (x=292–382). Dark purple rounded rectangle. Shows "SCORE" label + live number. Animates to 1.15× scale on each update.

**Row 2 — Moves & Objectives**
- **MOVES box:** Centred (x=151–239). Large gold number. Turns orange at ≤10 moves, red at ≤5. Red triggers a scale-pulse animation.
- **Objectives text:** Left-side (x=14). One line per objective: "TypeName: collected/total". Turns green when complete.

**Row 3 — Energy Bars**
Three 100px-wide progress bars at x=14, 146, 278.
- Each has a dark track with coloured outline
- Fill grows left-to-right as energy accumulates
- When full (100%): white overlay flash on fill

**Row 4 — Spell Slots**
Three spell slot containers at x=65, 195, 325 (y=182).
- Empty: shows `spell_slot` image + dim "Spell N" label (50% alpha)
- Active: shows `spell_slot_active` + spell emoji icon + abbreviated name, full alpha
- Scale 0→1 `Back.easeOut` animation when spell becomes available
- Hover: scale to 1.1×
- Tap: cast the spell, animate slot clearing

---

## 15. Pause Menu

**File:** `src/ui/PauseMenu.ts`

Triggered by tapping the ⏸ button. Overlays the full game screen.

**Components:**
- **Dim overlay:** Black at 65% opacity, covers full canvas (`DEPTHS.overlay`)
- **Panel:** Dark purple (`#1a0a3a`) rounded rectangle, 280×360px, centred. Gold outer border + purple inner border.
- **Title:** "PAUSED" in gold Georgia serif with purple stroke
- **Cat icon:** 🐱 emoji at 48px
- **Three buttons:**

| Button | Colour | Action |
|---|---|---|
| ▶ RESUME | Green (`#00ff88`) | Hides menu, re-enables board interaction |
| ↺ RESTART | Purple Light | Fades out, restarts `GameScene` with same `levelId` |
| ⌂ QUIT | Dark slate | Fades out, starts `HomeScene` |

**Show/Hide animation:** Panel scales 0.85→1 with `Back.easeOut` (300ms). Both overlay and panel fade simultaneously on hide.

**Button interactions:** Scale 0.94× on press (70ms yoyo), scale 1.04× on hover.

---

## 16. Bottom Navigation

**File:** `src/ui/BottomNav.ts`

A persistent navigation bar rendered at the bottom of the screen.

**Dimensions:**
- Height: 88px
- Y position: 756px (= GAME_HEIGHT − 88)
- Background: `#130828` at 97% opacity with a thin purple top border

**Five tabs:**

| Tab | Icon | X Position |
|---|---|---|
| Shop | `tab_store` | 10% = ~39px |
| Trophy | `tab_rank` | 30% = ~117px |
| **Home (FAB)** | `tab_home` | 50% = 195px |
| Social | `tab_social` | 70% = ~273px |
| Profile | `tab_profile` | 90% = ~351px |

**Home tab is a FAB (Floating Action Button):**
- 82×82px rounded square
- Elevated: top edge at `756 − 82 + 14 = 688px` (floats above the bar)
- Drop shadow behind it
- Active colour: `#6030c8` / Inactive: `#2e1470`

**Regular tabs:**
- 66×66px rounded square holder
- Active: purple fill + bright border + bold label + full alpha icon
- Inactive: dim fill + dim border + normal label + 70% alpha icon
- Icon size: 54×54px

**Navigation:** All tab interactions use a 250ms camera fade-out before starting the target scene. If the route is a function (not a scene key), it is called directly.

---

## 17. Win & Lose Conditions

### Win Condition
Checked in `GameScene.checkWinCondition()` after every move resolves:
```
WIN = ALL objectives collected AND score >= scoreTarget
```

Both conditions must be true simultaneously. Checked after every `onBoardStable()` event.

### Lose Condition
Checked in `GameScene.onBoardStable()`:
```
LOSE = movesLeft reaches 0 AND (score < scoreTarget OR objectives not met)
```

Even when moves run out, if the win condition is already met, it resolves as a victory.

### Victory Flow
1. `board.setInteractive(false)` — prevents further input
2. `companion.react('celebrating')`
3. `effects.spawnVictoryBurst()` — particle explosion + shake + gold flash
4. After 1200ms: calculate stars (1–3), fade out, start `VictoryScene`

### Defeat Flow
1. `board.setInteractive(false)`
2. `companion.react('worried')`
3. Screen shake (6 intensity, 400ms)
4. Black overlay fades in (70% opacity)
5. "Out of Moves!" text and score displayed
6. After 600ms: **TRY AGAIN** button appears (restarts `GameScene`)
7. **Quit** text link (returns to `HomeScene`)

---

## 18. Victory Scene

See [Section 4 — VictoryScene](#victoryScene) above.

**Star calculation summary:**
- Score < target → 1 star
- Score ≥ target → 2 stars
- Score ≥ 1.5× target → 3 stars

---

## 19. Level Definitions

**12 levels total**, defined in `Constants.ts`:

| Level | Moves | Score Target | Objectives |
|---|---|---|---|
| 1 | 22 | 800 | Star ×15 |
| 2 | 20 | 1,200 | Potion ×12, Star ×10 |
| 3 | 18 | 1,600 | Gem ×10, Book ×8 |
| 4 | 24 | 2,000 | Star ×20, Gem ×15 |
| 5 | 16 | 2,400 | Potion ×18, Crystal ×10 |
| 6 | 20 | 3,000 | Star ×25, Book ×12 |
| 7 | 18 | 3,500 | Gem ×20, Crystal ×15 |
| 8 | 15 | 4,000 | Potion ×20, Star ×18 |
| 9 | 22 | 4,500 | Star ×30, Gem ×20 |
| 10 | 20 | 5,000 | Crystal ×20, Book ×15 |
| 11 | 18 | 5,500 | Star ×28, Potion ×22 |
| 12 | 16 | 6,000 | Gem ×25, Crystal ×18 |

**Difficulty progression:**
- Levels 1–4: Learning curve, generous moves
- Levels 5–8: Tighter move limits, larger tile counts
- Levels 9–12: High targets, fewer moves, dual objectives on most

---

## 20. Asset List

### Background Images
| Key | File | Used In |
|---|---|---|
| `ui_home` | `assets/ui_home.jpg` | HomeScene |
| `ui_gameplay` | `assets/ui_gameplay.jpg` | GameScene |
| `ui_victory` | `assets/ui_victory.png` | VictoryScene |
| `splash` | `assets/splash.png` | PreloadScene loading bar bg |

### Tile Images
| Key | Tile Type |
|---|---|
| `tile_star` | Star (gold) |
| `tile_potion` | Potion (purple) |
| `tile_gem` | Gem (cyan) |
| `tile_book` | Book (orange) |
| `tile_crystal` | Crystal (pink) |
| `tile_*_cursed` | Cursed variants of each tile |
| `tile_sleeping_cat` | Sleeping cat blocker |

### UI Icons (PNG)
| Key | Description |
|---|---|
| `tab_home` | Home nav tab icon |
| `tab_store` | Shop nav tab icon |
| `tab_profile` | Profile nav tab icon |
| `tab_social` | Social nav tab icon |
| `tab_rank` | Trophy nav tab icon |
| `icon_coin_paw` | Coin/paw currency icon |
| `icon_heart` | Lives/heart icon |
| `ui_plus_icon` | + button for currency pills |
| `ui_holder` | Generic holder background |
| `ui_green_circle_button` | Green circle button |

### UI Icons (SVG)
| Key | Size | Description |
|---|---|---|
| `icon_settings` | 156×156 | Settings gear |
| `icon_coin` | 44×44 | Coin icon |
| `icon_btn_plus` | 32×32 | Plus button |
| `icon_nav_home/cats/spells/quests` | 72×72 | Nav variants |

### Spell UI
| Key | Description |
|---|---|
| `spell_slot` | Empty spell slot background |
| `spell_slot_active` | Active/filled spell slot background |

### Character
| Key | Description |
|---|---|
| `cat_wizard` | Wizard cat companion image |

### Particle Textures
| Key | Used For |
|---|---|
| `particle_spark` | Match bursts, victory |
| `particle_star` | Big match bursts, victory fireworks |
| `particle_orb` | Select burst, portal effects, ambient |
| `particle_flare` | Spell casts, meteor trail |

---

## 21. Depth Layers (Z-Order)

All game objects are assigned a depth value. Higher depth = rendered on top.

| Layer Name | Value | Contents |
|---|---|---|
| `bg` | 0 | Background images |
| `board` | 10 | Board background panel, grid lines, corner runes, portal rings |
| `tiles` | 20 | All tile containers (row offset +0.1 per row for sub-ordering) |
| `effects` | 30 | Particles, score popups, lightning, match bursts |
| `ui` | 40 | HUD background, energy bars, bottom nav bar, bottom cover |
| `overlay` | 50 | Combo text, spell cast text, defeat overlay |
| `companion` | 60 | Cat companion + sparkles + speech bubble |
| `hud` | 70 | HUD text elements (level, moves, score, labels) |
| `popup` | 80 | Interactive hit zones, pause menu panel |

---

## 22. Animation Timings

| Constant | Value | Used For |
|---|---|---|
| `ANIM.tileSwap` | 200ms | Tile sliding to new position |
| `ANIM.tileFall` | 280ms | Tile falling after gravity |
| `ANIM.tileDestroy` | 180ms | Tile match pop animation |
| `ANIM.spellCast` | 600ms | Delay before spell effect executes |
| `ANIM.screenShake` | 300ms | Camera shake duration |
| `ANIM.comboDelay` | 120ms | Stagger multiplier for wave-style tile destruction |

---

## 23. Full Game Flow Diagram

```
App Launch
  │
  ▼
BootScene → KemeSplashScene (2.5s) → CatSplashScene (3s) → PreloadScene
                                                                │
                              ┌─────────────────────────────────┘
                              │ All assets loaded
                              ▼
                          HomeScene
                              │
                          [Tap Play]
                              │
                              ▼
                 ┌──────── GameScene ────────────────────────────┐
                 │  init: levelId, movesLeft, scoreTarget,       │
                 │  objectives[]                                  │
                 │                                               │
                 │  ┌── Player swaps tiles ──────────────────┐   │
                 │  │                                         │   │
                 │  │  No match → swap back + ✕ effect       │   │
                 │  │                                         │   │
                 │  │  Match found:                           │   │
                 │  │    • Tiles destroy (wave animation)     │   │
                 │  │    • Score += size × 100 × multipliers  │   │
                 │  │    • Energy bars fill                   │   │
                 │  │    • Objectives track                   │   │
                 │  │    • Cascade check (combo loop)         │   │
                 │  │    • Gravity + refill                   │   │
                 │  │    • movesLeft-- (after board stable)   │   │
                 │  │                                         │   │
                 │  │  Energy threshold reached:              │   │
                 │  │    • Spell unlocked in slot             │   │
                 │  │    • Cat reacts "casting"               │   │
                 │  │    [Tap spell slot]                     │   │
                 │  │    • Spell effect executes              │   │
                 │  │    • Board refills                      │   │
                 │  │                                         │   │
                 │  │  Special cells:                         │   │
                 │  │    • Cursed cells block matching        │   │
                 │  │    • Sleeping cat blocks selection      │   │
                 │  │    • Portals trigger visual effect      │   │
                 │  │    • Curse spreads 25% per move        │   │
                 │  └─────────────────────────────────────────┘   │
                 │                                               │
                 │  movesLeft = 0?                               │
                 │    WIN condition met → VictoryScene           │
                 │    WIN not met → Defeat screen               │
                 │                                               │
                 │  [Pause ⏸]                                    │
                 │    → Resume / Restart / Quit                  │
                 └───────────────────────────────────────────────┘
                              │
                    ┌─────────┴────────┐
                    ▼                  ▼
              VictoryScene      HomeScene (Quit)
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
    GameScene              GameScene
    (Next Level)           (Replay)
```

---

*Documentation generated for Cat Spellbound v0107 — May 2026*
