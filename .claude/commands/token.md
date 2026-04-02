Look up design tokens matching: $ARGUMENTS

Read the file `tokens.css` in the project root. Search for all CSS custom properties whose name or comment contains "$ARGUMENTS" (case-insensitive).

Return a compact table:

| Token | Value | Usage |
|-------|-------|-------|
| `--token-name` | value | one-line description |

If $ARGUMENTS is empty, return the full token index grouped by category:
- Colors (brand, semantic, text, surface, dice)
- Typography (families, sizes, weights, spacing)
- Spacing
- Border radius
- Shadows
- Animation (durations, easings)
- Z-index

Also flag if the user is asking about a value that exists as a hardcoded hex/px — suggest the correct token instead.

End with a reminder: never use hardcoded values in component CSS; always reference a token.
