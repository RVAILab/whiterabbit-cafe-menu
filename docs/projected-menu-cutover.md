# Projected menu production cutover

This checklist is the human-run portion of GitHub issue #13. Keep the current
player deployment available until every verification step passes.

## Deployment record — 2026-08-12

- WR-POS production: `dpl_j61TB3YUWo2K2LvEauyhFZogpTqg`
  (`https://wr-pos.vercel.app`). Previous deployment:
  `dpl_Gj6Satrzbym6m3aKfdq7FLgGRRLw`.
- Menu production: `dpl_2vLJTUeKYMp4qUyF1RKuF2ACynuE`
  (`https://menu.whiterabbitashland.com`). The immediately preceding,
  functional Odoo-player deployment is `dpl_EpY69naD5ixzNN6PUc6SddUzxwW3`.
- Display control uses the separate `display_control` database in the existing
  Neon project. It does not create tables in the `neondb` member database.
- Odoo projected-menu membership was applied and verified for 21 templates.
- The retired Sanity `Viewer App` and `Display API (Vercel Function)` tokens
  were revoked. The legacy pre-cutover deployment therefore is not an
  executable rollback target.
- Automated production checks passed. Physical projector verification and
  approver sign-off remain pending.

## Before deployment

- Rotate the Sanity token that was formerly embedded in `player/test-query.js`.
- Provision a database used only for display control. Do not use the MemberDB
  connection.
- Apply WR-POS `migrations/001_display_control.sql` to that database.
- Configure WR-POS:
  - `DISPLAY_CONTROL_POSTGRES_URL`
  - `DISPLAY_API_KEY`
  - `DISPLAY_CONTROL_ALLOWED_ORIGIN=https://menu.whiterabbitashland.com`
- Configure the menu player with the deployed WR-POS URLs:
  - `VITE_PROJECTED_MENU_URL=https://<wr-pos-host>/api/projected-menu`
  - `VITE_DISPLAY_CONTROL_URL=https://<wr-pos-host>/api/display-control`
- For a cross-origin WR-POS host, verify CORS answers `OPTIONS`, permits `GET`
  and `If-None-Match` from the exact player origin, and exposes `ETag` to the
  browser. Both polling clients send conditional requests after the first load.
- Preserve the current player deployment URL or deployment identifier as the
  rollback target.

## Approve and seed Odoo membership

Run `npm run projected-menu:seed-plan` in WR-POS and compare its read-only
proposal with the physical wall menu. Do not seed until these discrepancies are
resolved:

- Product 579 is named Dubai Mocha in the former wall-menu data but is archived
  in Odoo; WR-POS history identifies product 578 as Dubai Mocha.
- Product 978, Bone Broth + Half Roast Beef & Havarti, is not register-enabled.
- Tea Time groups Green & Black and Herbals have no Odoo product identity.

The approved migration may write only `x_projected_menu_section` on
`product.template`. It must not change `active` or `available_in_pos`.

## Staging verification

- Fetch `/api/projected-menu` and confirm schema version 1, all expected
  non-empty sections, alphabetical items, grouped sizes, and stock verdicts.
- Fetch it again with `If-None-Match` and confirm a `304` response.
- Exercise WR-POS display commands for sleep, closed, each visualization,
  background/fullscreen, and return-to-primary.
- Confirm an unauthorized cross-origin display-control write is rejected.
- Confirm the player build contains no Sanity client, token, or environment
  configuration.

## Physical display verification

- Compare every featured item, section, name, price, and size with Odoo.
- Verify available, sold-out, and untracked examples. Sold-out items must remain
  in place, and a sold-out size must not appear sellable.
- Change one membership, name, price, and stock quantity in the approved test
  set; confirm each reaches the wall after the next 20-second poll.
- Confirm all sections fit and remain readable in the physical space.
- Restart the display and confirm the last valid menu appears before or while
  the first refresh completes.
- Disconnect the network, confirm the last valid menu remains visible, then
  reconnect and confirm recovery without a reload.
- Re-test sleep/closed overlays and every visualization on the physical screen.

## Sign-off and rollback

If the current cleanup deployment fails, restore the preceding functional
Odoo-player deployment from this repository root:

```sh
vercel rollback dpl_EpY69naD5ixzNN6PUc6SddUzxwW3 --yes
```

Do not roll WR-POS back independently: the current player requires its
projected-menu and display-control endpoints. A coordinated legacy rollback
would also require rebuilding the old player with newly issued Sanity
credentials; the retired credentials cannot be restored.

After sign-off:

- Retire projected-menu-only Sanity deployment configuration and credentials.
- Preserve any required Sanity export for historical reference.
- Record the deployed player and WR-POS versions and the approver/date.
