# Workout illustration assets — licence notice

Exercise figures on the workout page are loaded at runtime from
[Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim,
via the jsDelivr CDN mirror of that repository.

- Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Change made for this site: `fill="#fff"` → `fill="currentColor"`
  (done in the browser by `assets/js/workout-art.js`) so the figures
  inherit the site's active theme colour. No other modification.
- Credit is also given on the workout page itself, next to the figures.

Upstream artwork incorporates poses from
[Everkinetic](https://github.com/everkinetic/data) (also CC BY-SA 4.0);
see Workout Guide's `ATTRIBUTION.md` and `manifest.json` for details.

## Original training sheet

The owner supplied the original photograph. Its public static copy has been removed.
ImageGen restored only the handwritten name and gender fields to blank paper,
preserving the original photograph's layout and texture. The restored artwork is
stored encrypted under `assets/ledger-paper.enc`; it is not a public asset.
`/api/ledger-card` returns a composed training card for the authenticated owner or
an active, unexpired share token. Display name and gender are opt-in profile values.
Kalam supplies Latin handwriting; Noto Sans CJK supplies Chinese glyphs. Font
licenses are bundled with the corresponding assets. Visible composed cards remain
capturable; this does not promise screenshot prevention.


`guide/` bundles the three unmodified SVG frames for bicep-curl, pull-up,
seated-row and lat-pulldown from Workout Guide (retrieved 2026-10-16). The browser
recolors white strokes to the active theme as described above. The bicep-curl
figure is an illustrative nudge response, not an additional logged workout.
