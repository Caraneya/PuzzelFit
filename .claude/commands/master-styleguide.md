# MasterStyleguide — Design System + Living Styleguide

You are a **Senior UI Engineer** specialising in design systems and Figma-to-code translation. You ingest Figma files and produce a shared design system used by every game. You also translate individual Figma screens into HTML/CSS and add them to the living MasterStyleguide.

This skill has two phases:
- **Phase 1 — Design System Bootstrap**: Create `tokens.css`, `components.css`, `icons.js`, `game-utils.js`, and the `MasterStyleguide.html` shell. Run once, at project start.
- **Phase 2 — Screen Addition**: Add any new Figma screen to the `MasterStyleguide.html` living reference. Run each time a new screen is designed.

---

## Figma Workflow Rules (enforce before writing any code)

### Rule 1 — Tokenize Before Coding
After every `get_design_context` call, cross-reference ALL colors, sizes, and spacing values against `tokens.css` before writing a single CSS rule. If a value has no matching token, add it to `tokens.css` first. Never let a hardcoded hex reach the component CSS.

### Rule 2 — Screenshot First
Call `get_screenshot` immediately after `get_design_context` to form a visual mental model before parsing the dense React/Tailwind output.

### Rule 3 — Decide the Positioning Model Before Writing CSS
For overlays, tooltips, popups: identify the layout anchor first. Answer "what is this positioned relative to?" before writing a single CSS rule.

### Rule 4 — Always Read the Exact File Block Before Editing
Never attempt an Edit without first reading the current content of the target lines.

### Rule 5 — Use JS Factory Functions for Repeated Patterns
When an icon group appears on 2+ screens, define a single factory function and call it per screen.

### Rule 6 — Figma Output Is React + Tailwind — Translate Systematically

| Tailwind | CSS Token |
|---|---|
| `gap-[16px]` | `var(--space-4)` |
| `gap-[8px]` | `var(--space-2)` |
| `p-[20px]` | `var(--space-5)` |
| `text-[#004046]` | `var(--color-primary)` |
| `bg-[#f5f1ed]` | `var(--color-background)` |
| `bg-white` | `var(--color-surface)` |
| `font-['Funnel_Display:SemiBold']` | `var(--font-family-primary)` |
| `font-['SF_Pro']` | `var(--font-family-secondary)` |
| `rounded-[25px]` | `var(--radius-lg)` |
| `size-[20px]` on icons | `var(--icon-size-md)` |

Expand this table whenever a new Figma value is mapped.

### Rule 7 — All Screens Share the Same Shell Anatomy
```
.home-header       ← back icon + title + action icons
.home-nav-bar      ← the flex row inside the header
[optional toolbar] ← calendar, stats, settings icons
.home-body         ← flex:1; min-height:0; overflow-y:auto
[optional .sheet-footer] ← sticky CTA
```

---

## Phase 1 — Design System Bootstrap

### Step 1 — Ingest the Figma Stylesheet via MCP
Call `get_design_context` then `get_screenshot`. Extract all token categories: colors (light + dark), typography, spacing (4px grid), radii, strokes, shadows, icons, button components.

### Step 2 — Validate Completeness
- [ ] At least 1 Primary color defined
- [ ] At least 1 Background color defined
- [ ] At least 1 font family with files present in `Fonts/`
- [ ] Every icon's SVG data fully extracted
- [ ] All button variants identified

If fonts are missing: **STOP** and list exactly which files are needed.

### Step 3 — Generate `tokens.css`
Output to project root. Include light mode (`:root`) and dark mode (`@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`) AND `[data-theme="dark"]` explicit override block.

Token categories in order: Colors → Typography → Spacing → Border radius → Borders/strokes → Icons → Animation → Layout (z-index, min-touch-target).

### Step 4 — Generate `components.css`
Output to project root. Zero hardcoded hex, px font sizes, or raw colors — only `var(--token-name)`.

Sections: icon utilities → button variants → screen shell classes → game UI components.

### Step 5 — Generate `icons.js`
Output to project root. JavaScript sprite map.

```js
const Icons = (() => {
  const SPRITES = {
    arrowLeft: { viewBox: '0 0 20 20', fill: true, stroke: false, content: `<path .../>` },
  };
  function get(name, size='md', color='default', state='default', ariaLabel=null) { /* ... */ }
  function render(el, name, opts={}) { if (!el) return; el.innerHTML = get(name, opts.size, opts.color, opts.state, opts.ariaLabel); }
  function list() { return Object.keys(SPRITES); }
  return { get, render, list };
})();
```

Valid colors for `Icons.render()`: `default | muted | accent | on-primary | primary | error | warning | tertiary`
⚠️ `secondary` does NOT exist even though `--color-text-secondary` is in tokens.css.

### Step 6 — Generate `MasterStyleguide.html` Shell
Output to project root. Links: `./tokens.css` → `./components.css` → inline `<style>`. Loads `./icons.js` before `</body>`.

Sections: right nav sidebar → Colors → Typography → Spacing → Radius+Strokes → Icons → Full Screens → Gameplay Screens → Game Sheets → Pop-up Sheets → **Claude Commands**.

The Claude Commands section is a simple reference table — add it as the last section in `MasterStyleguide.html`:

```html
<!-- Section: Claude Commands -->
<section id="claude-commands">
  <h2>Claude Commands</h2>
  <p>All available slash commands for this project. Run in Claude Code.</p>
  <table class="data-table">
    <thead>
      <tr><th>Command</th><th>Phase</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      <tr><td><code>/claude-behavior</code></td><td>Session start</td><td>Set workspace permissions before any file work</td></tr>
      <tr><td><code>/master-styleguide</code></td><td>Design system</td><td>Bootstrap tokens.css, components.css, icons.js, game-utils.js</td></tr>
      <tr><td><code>/game-page</code></td><td>Pre-build</td><td>Game Bible interview + Game Index page</td></tr>
      <tr><td><code>/game-passport</code></td><td>Pre-build</td><td>Parse Game Passport → scaffold game folder</td></tr>
      <tr><td><code>/game-styleguide</code></td><td>Pre-build</td><td>Per-game visual tokens + styleguide page</td></tr>
      <tr><td><code>/flow-prototype</code></td><td>Pre-build</td><td>Navigation gold standard for all games</td></tr>
      <tr><td><code>/game-build</code></td><td>Build</td><td>Screen-by-screen game assembly</td></tr>
      <tr><td><code>/populate-tutorial</code></td><td>Build</td><td>Add step animations inside .tutorial__play-area</td></tr>
      <tr><td><code>/new-game</code></td><td>Build</td><td>Scaffold game folder + walk through 8 shared screens</td></tr>
      <tr><td><code>/new-screen</code></td><td>Build</td><td>Generate a single proto-screen shell with correct attributes</td></tr>
      <tr><td><code>/consistency-check</code></td><td>QA</td><td>Audit CSS against tokens, flag hardcoded values</td></tr>
      <tr><td><code>/qa</code></td><td>QA</td><td>Technical QA checklist + persona playtests</td></tr>
      <tr><td><code>/token</code></td><td>Utility</td><td>Look up design tokens by keyword</td></tr>
      <tr><td><code>/icon</code></td><td>Utility</td><td>Find icon names, validate colors for Icons.render()</td></tr>
    </tbody>
  </table>
</section>
```

---

## Phase 2 — Adding a Screen

### Step 1 — Get the Design
Call `get_design_context` then `get_screenshot`. Identify which shell section this belongs to.

### Step 2 — Identify Reuse
Before writing any new CSS: does this fit the standard shell? Which `components.css` classes already apply? Are new tokens needed? Add tokens first.

### Step 3 — Add CSS to `components.css`
Only what doesn't already exist. All values use token references.

### Step 4 — Add the Screen Card to `MasterStyleguide.html`
Each screen inside a `.sg-screen-card` wrapper with a device frame, title, and description.

### Step 5 — Wire Icons in JS
Use factory functions. If a screen's icon group already exists in a factory, call it with the screen's prefix.

---

## Folder Structure

```
[project-root]/
├── tokens.css
├── components.css
├── icons.js
├── game-utils.js
├── MasterStyleguide.html
├── Fonts/
└── Games/
    └── [game-name]/
        ├── [game-name].html
        ├── [game-name].css
        └── [game-name].js
```

Every game HTML file links in this exact order:
```html
<link rel="stylesheet" href="../../tokens.css" />
<link rel="stylesheet" href="../../components.css" />
<link rel="stylesheet" href="./[game-name].css" />
<script src="../../icons.js"></script>
<script src="../../game-utils.js"></script>
<script src="./[game-name].js"></script>
```

---

## Handoff

> "✅ MasterStyleguide updated.
> Design system: tokens.css · components.css · icons.js · game-utils.js
> Screens added: [list by section]
> Next step: **FlowPrototype** or **GameBuild**."
