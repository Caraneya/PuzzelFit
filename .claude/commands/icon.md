Look up icon information for: $ARGUMENTS

Read `icons.js` in the project root. 

If $ARGUMENTS is an icon name (or partial name): search for matching icon keys in the `ICONS` object and show:
- The exact key name to use in `Icons.render(el, 'KEY', options)`
- A text description of the icon shape if available

If $ARGUMENTS is empty or "list": show all available icon names grouped logically (navigation, actions, status, etc.).

Always end the response with the complete valid color list for `Icons.render()`:

**Valid colors:** `default` | `muted` | `accent` | `on-primary` | `primary` | `error` | `warning` | `tertiary`

⚠️ `secondary` is NOT a valid color even though `--color-text-secondary` exists in tokens.css. Using it silently produces wrong output.

**Usage pattern:**
```javascript
Icons.render(element, 'iconName', { size: 'md', color: 'primary' });
// OR for inline HTML:
Icons.get('iconName', 'md', 'primary')
```

Valid sizes: `xs` | `tiny` | `sm` | `md` | `game` | `lg` | `xl`
