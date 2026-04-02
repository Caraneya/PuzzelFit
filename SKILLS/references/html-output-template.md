# Shared HTML Output Template

Every skill generates a self-contained `.html` output page. All pages MUST follow these rules without exception.

---

## THE ONE RULE

**Every color, font, spacing, radius, shadow, and animation value used on this page must come from `tokens.css` via CSS custom properties. Zero hard-coded values. Zero Google Fonts. Zero system font names.**

---

## Link Order (ALWAYS in this order)

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>[Page Title]</title>
  <!-- 1. tokens — ALWAYS FIRST -->
  <link rel="stylesheet" href="../../tokens.css" />  <!-- from Games/[game-name]/ -->
  <!-- or -->
  <link rel="stylesheet" href="./tokens.css" />      <!-- from project root -->
</head>
```

---

## Base Shell

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>[SKILL OUTPUT TITLE] — [GAME NAME]</title>
  <link rel="stylesheet" href="../../tokens.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 100%;
      background-color: var(--color-background);
      color: var(--color-text-primary);
      font-family: var(--font-family-primary);
      font-size: var(--font-size-body);
      line-height: var(--line-height-normal);
    }
    .page-wrapper {
      max-width: 900px;
      margin: 0 auto;
      padding: var(--space-12) var(--space-6) var(--space-24);
    }
    .token-warning {
      background-color: var(--color-warning, #f9a826);
      color: var(--color-background, #0f1117);
      padding: var(--space-4, 16px) var(--space-6, 24px);
      border-radius: var(--radius-lg, 16px);
      margin-bottom: var(--space-8, 32px);
      font-weight: var(--font-weight-bold, 700);
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <!-- HERO -->
    <div class="hero">
      <div class="hero-eyebrow">[SKILL EMOJI] [SKILL NAME] · [GAME NAME]</div>
      <h1 class="hero-title">[PAGE TITLE]</h1>
      <p class="hero-subtitle">[ONE LINE DESCRIPTION]</p>
    </div>

    <!-- PIPELINE STATUS -->
    <div class="pipeline">
      <div class="pipeline-step pipeline-step--done">GamePage</div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step pipeline-step--active">CurrentStep</div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step">NextStep</div>
    </div>

    <!-- CONTENT SECTIONS -->
    <!-- Use .section-card + .section-header + .section-badge + .section-title -->

    <!-- FOOTER -->
    <div class="page-footer">
      <div class="footer-pipeline">
        <span class="footer-step footer-step--done">✅ GamePage</span>
        <span>→</span>
        <span class="footer-step footer-step--current">CurrentStep</span>
      </div>
      <div class="footer-meta">Generated [DATE]</div>
    </div>
  </div>
</body>
</html>
```

---

## Per-Skill Output Files

| Skill | Output File | Location | tokens.css path |
|---|---|---|---|
| `/game-page` | `[game]-game-bible.html` | `Games/[game]/` | `../../tokens.css` |
| `/master-styleguide` | `MasterStyleguide.html` | project root | `./tokens.css` |
| `/consistency-check` | `[game]-audit.html` | `Games/[game]/` | `../../tokens.css` |
| `/qa` | `[game]-qa-technical.html` or `[game]-qa-[persona].html` | `Games/[game]/` | `../../tokens.css` |

---

## Hard Rules Summary

1. `tokens.css` linked first in `<head>` — before the `<style>` block
2. Every CSS value uses `var(--token-name)` — zero raw hex, px font sizes, or color names
3. Every font reference uses `var(--font-family-primary)` or `var(--font-family-secondary)`
4. No Google Fonts `<link>` tags — ever
5. When `tokens.css` doesn't exist yet, show the `.token-warning` banner
