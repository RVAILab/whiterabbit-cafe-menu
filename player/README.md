# White Rabbit Cafe Menu Player

The player renders White Rabbit's customer, projector, and print menus from the
versioned projected-menu document produced by WR-POS from Odoo.

## Runtime data

The menu is loaded from `GET /api/projected-menu` on startup and refreshed every
20 seconds. Responses are schema-validated before display, cached in browser
storage, and requested with `ETag` / `If-None-Match`. A malformed response never
replaces the last valid menu, and a network outage leaves that cached menu on
screen. If no valid document exists, the player shows an unavailable message and
continues retrying.

In development the default endpoint is
`http://localhost:3000/api/projected-menu`. Production builds require an
explicit `VITE_PROJECTED_MENU_URL`; the build fails with a clear error when it
is absent, rather than silently targeting a same-origin route that may not
exist.

WR-POS is the menu authority. Product membership, names, prices, variants, and
availability originate in Odoo and reach the player through the projected
document. Run the WR-POS API locally when developing against live menu data.

## Display controls

The projector retains its sleep and closed overlays plus the bubbles, geometric,
and waveforms visualizations. It polls `GET /api/display-control` every two
seconds (or `VITE_DISPLAY_CONTROL_URL`) for desired overlay and visualization
state. One-shot `primary` screen commands work; unknown secondary-screen keys are
ignored safely. The last validated desired state, revision, and ETag are cached
and restored before paint after a restart; cached one-shot screen commands are
never replayed. Production builds also require an explicit
`VITE_DISPLAY_CONTROL_URL`. Announcements and secondary-screen content are
intentionally not part of the v1 projected document.

When either API is hosted on a different origin, its CORS configuration must
handle browser preflight requests caused by `If-None-Match`: answer `OPTIONS`,
allow `GET` and the `If-None-Match` request header, return the player's exact
allowed origin, and expose the `ETag` response header with
`Access-Control-Expose-Headers: ETag`.

Local projector keyboard controls remain available:

- `0`: toggle sleep overlay
- `9`: toggle closed overlay
- `1`, `2`, `3`: toggle bubbles, geometric, or waveforms
- `F`: toggle visualization fullscreen mode
- `Escape` or `Backspace`: return to the primary screen

## Routes

- `/`: scrollable customer menu
- `/projection`: fullscreen projector menu and display controls
- `/print`: dark 11×17 print layout
- `/print-light`: light 11×17 print layout

## Development

```bash
npm install
npm run dev
```

Environment variables are documented in `.env.example`. The two API endpoints
are optional in development and mandatory for a production build. No menu
credentials are required by the browser.

## Verification

```bash
npm test
npm run build
npm run lint
```

The player should be able to build and run without any legacy CMS configuration.
