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

`exercise-list-original.png` is the exact image supplied by the site owner on
2026-10-15. SHA-256: `6838b4e690021406d106d33121e227515f4b8f3ec34461e53f70fd46aa55d19d`.
No crop, retouch, filter, reconstruction or replacement of its existing handwriting.
New dates and training values are separate HTML overlays in blank areas. Kalam
Regular is used only for newly added values; the embedded EAZY LEE / M remain pixels
in the owner's image. Font license is bundled in `assets/fonts/training-hand/OFL.txt`.


`guide/` bundles the three unmodified SVG frames for bicep-curl, pull-up,
seated-row and lat-pulldown from Workout Guide (retrieved 2026-10-16). The browser
recolors white strokes to the active theme as described above. The bicep-curl
figure is an illustrative nudge response, not an additional logged workout.
