Generate a new proto-screen for: $ARGUMENTS

$ARGUMENTS format: "screen-id [type]"
- screen-id: the data-screen value, e.g. "screen-gameplay"
- type (optional): "initial" if this is the first visible screen, otherwise omitted

---

Ask the user one question before generating:

"Does this screen need a standard shell (home-header nav bar → optional toolbar → scrollable body) or a custom layout?"

- **Standard shell**: generate with `.home-header` + `.home-nav-bar` + `.game-main` structure
- **Custom layout**: generate a bare proto-screen container and ask what goes inside

---

Generate the HTML block with these rules:

**If NOT the initial screen** (default):
```html
<div class="proto-screen" data-screen="SCREEN_ID" inert>
  <!-- content -->
</div>
```

**If initial screen** (type = "initial"):
```html
<div class="proto-screen is-visible is-active" data-screen="SCREEN_ID">
  <!-- content -->
</div>
```

**Standard shell anatomy** (inside the proto-screen):
```html
<div class="home-page">
  <header class="home-header">
    <nav class="home-nav-bar">
      <!-- back button left, title center, actions right -->
    </nav>
  </header>
  <main class="game-main">
    <!-- scrollable content here -->
  </main>
</div>
```

**Sheet overlays** (win/lose/pause etc.) always get `data-no-dismiss` if they are result screens:
```html
<div class="sheet-overlay" id="sheet-SCREEN_ID" data-no-dismiss>
  <div class="sheet">
    <div class="sheet__header"> ... </div>
    <div class="sheet__illustration"> ... </div>
    <div class="sheet__actions"> ... </div>
  </div>
</div>
```

---

After generating, remind the user:
- Add `GameUtils.navigateTo('SCREEN_ID')` wherever this screen should be triggered in JS
- Navigation removes `inert` and adds `is-visible` → `is-active` (two-frame rAF) automatically
- Never manually toggle `display` — use `navigateTo` from `game-utils.js`
