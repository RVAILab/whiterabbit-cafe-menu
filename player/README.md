# Cafe Menu Player

A real-time digital menu display optimized for projectors and kiosk mode, powered by Sanity CMS.

## Features

- **Real-time updates**: Menu changes instantly reflect from Sanity
- **Projector-optimized**: High contrast dark theme, viewport-based scaling
- **Offline resilience**: Continues displaying last known menu if connection drops
- **Sold-out handling**: Items automatically gray out or show "SOLD OUT" badge
- **Multiple modes**: Switch between cafe/bar menus via Sanity Studio
- **Kiosk-ready**: Hidden cursor, no scrolling, full-screen display
- **Now Playing widget**: Displays current Sonos track with album art (projector layout only)

## Tech Stack

- React 18+ with TypeScript
- Vite (build tool)
- Tailwind CSS v4
- Sanity Client (real-time listener)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Update `.env.local` with your Sanity credentials:

```env
VITE_SANITY_PROJECT_ID=your-project-id
VITE_SANITY_DATASET=production
VITE_SANITY_API_VERSION=2023-05-03
```

### 3. Configure Sanity Studio

Ensure your Sanity Studio has:

1. **Menu Items** with fields:
   - `title` (string)
   - `price` (number)
   - `isAvailable` (boolean)
   - `dietaryTags` (array: VE, V, GF, N, ALC)
   - `marketingDescription` (text)
   - `image` (image)

2. **Menu Board** document with:
   - `title` (string)
   - `slug` (slug)
   - `sections` (array of heading + items references)

3. **Kiosk Settings** singleton with:
   - `activeBoard` (reference to Menu Board)
   - `announcementBar` (optional string)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the menu.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - `VITE_SANITY_PROJECT_ID`
   - `VITE_SANITY_DATASET`
   - `VITE_SANITY_API_VERSION`

### Raspberry Pi Kiosk Mode

1. Install Chromium browser
2. Create autostart script:
   ```bash
   chromium-browser --kiosk --app=https://your-menu-url.vercel.app
   ```

## Project Structure

```
src/
├── components/
│   ├── BoardLayout.tsx      # Main grid container
│   ├── CategoryColumn.tsx   # Section with items
│   ├── MenuItem.tsx         # Individual menu item
│   └── NowPlayingWidget.tsx # Sonos now playing display
├── hooks/
│   ├── useMenuData.ts       # Real-time Sanity listener
│   └── useNowPlaying.ts     # Sonos playback polling
├── lib/
│   └── sanity.ts            # Sanity client config
├── types/
│   └── index.ts             # TypeScript interfaces
├── App.tsx                  # Main app component
├── main.tsx                 # Entry point
└── index.css                # Global styles + Tailwind
```

## Now Playing Widget (Sonos Integration)

The projector layout includes a "Now Playing" widget that displays the currently playing track from your Sonos system.

### Setup

1. **Configure environment variables** in `.env.local`:

```env
VITE_SONOS_SERVER_URL=https://your-sonos-server.com
VITE_SONOS_ZONE_ID=your-zone-id
VITE_SONOS_POLL_INTERVAL=3000  # Optional, defaults to 3000ms
```

2. **Find your Zone ID** by calling your Sonos server's zones endpoint:

```bash
curl https://your-sonos-server.com/api/zones/public
```

This returns available zones with their IDs:
```json
{
  "success": true,
  "data": [
    {
      "id": "0d64473e-922f-4a31-aad4-965d2e6e0c79",
      "name": "Full Clubhouse"
    }
  ]
}
```

### How It Works

- **Polling**: The widget polls the Sonos server every 3 seconds for current playback status
- **Smart visibility**: Only appears when music is actively playing (hidden when paused/idle)
- **Secondary screen aware**: Automatically hides when secondary screens are displayed
- **Resource efficient**: Stops polling when hidden to reduce API calls

### Widget Display

The widget shows:
- Album artwork thumbnail
- "NOW PLAYING" label (green)
- Track name (white)
- Artist name (pink)

### Files

- `src/components/NowPlayingWidget.tsx` - Widget UI component
- `src/hooks/useNowPlaying.ts` - Polling hook for Sonos API
- `src/types/index.ts` - TypeScript types for playback data

### Sonos Server Requirement

This feature requires a Sonos server (like [Earwicket](https://github.com/RVAILab/earwicket)) that provides:
- `GET /api/now-playing?zone_id={id}` - Returns current playback state and track metadata
- `GET /api/zones/public` - Returns available zones

The server must have CORS enabled for cross-origin requests from the menu app.

## Styling Architecture

### Hybrid Approach: Inline Styles + Tailwind v4

This app uses a **hybrid styling approach**:

1. **Inline styles** (primary): Used for all visual properties (colors, typography, sizing)
2. **Tailwind classes** (layout only): Used for flexbox, grid, and structural layout

**Why this approach?**
- Inline styles guarantee styles are applied (no compilation/bundling issues)
- Critical for kiosk/projector displays where reliability > maintainability
- Viewport units (`vw`, `vh`) used everywhere for responsive scaling
- No CSS modules, styled-components, or CSS-in-JS libraries needed

### ⚠️ Important for Developers

**When modifying styles:**
- ✅ **DO** use inline `style={{}}` props for spacing, colors, fonts, sizes
- ❌ **DON'T** rely on Tailwind utility classes for visual properties (they may not apply)
- ✅ **DO** use Tailwind for layout: `flex`, `grid`, `items-center`, etc.
- ❌ **DON'T** use Tailwind spacing classes like `mb-3`, `gap-4` - use inline styles instead

**Example - Correct approach:**
```tsx
// ✅ Good: Inline styles for spacing and visuals
<div style={{ marginBottom: '1rem', color: '#ffffff', fontSize: '2vw' }}>
  Item
</div>

// ✅ Good: Tailwind for layout structure
<div className="flex flex-col items-center">

// ❌ Bad: Tailwind spacing classes may not work
<div className="mb-4 text-white text-2xl">
```

### Layout System

The menu uses **CSS multi-column layout** (not flexbox grid):
- `BoardLayout.tsx` (lines 56-61): Creates responsive columns
- `columnWidth: '28rem'` and `columnGap: '4rem'` control layout
- Categories flow into columns automatically based on available space
- `breakInside: 'avoid'` keeps sections intact

### Typography & Spacing Scale

All sizes use **viewport units** for projector optimization:

```css
/* Typography (defined in index.css @theme) */
--font-size-xs: 1.2vw    /* Small labels */
--font-size-sm: 1.5vw    /* Descriptions */
--font-size-base: 1.8vw  /* Body text */
--font-size-lg: 2.2vw    /* Emphasis */
--font-size-xl: 3vw      /* Section headers */
--font-size-2xl: 3.5vw   /* Large headers */
--font-size-3xl: 5vw     /* Board title */

/* Spacing Scale */
--spacing-1: 0.5vw
--spacing-2: 1vw
--spacing-3: 1.5vw
--spacing-4: 2vw
--spacing-6: 3vw
--spacing-8: 4vw
```

### Color Palette

High-contrast dark theme optimized for projector displays:

```css
--color-dark-bg: #0a0a0a       /* Background */
--color-light-text: #ffffff    /* Item names */
--color-accent-pink: #ff4d9f   /* Section headers */
--color-accent-green: #7ed957  /* Prices */
--color-muted: #666666         /* Descriptions */
--color-warning: #fbbf24       /* Sold out badge */
```

## Real-time Updates with Sanity

### How the Sync System Works

The app uses Sanity's real-time listener via the `useMenuData` hook (`src/hooks/useMenuData.ts`):

#### 1. Initial Load (Lines 30-55)
```typescript
// Fetches kioskSettings with nested activeBoard and all menu items
const result = await client.fetch<KioskSettings[]>(ACTIVE_BOARD_QUERY)
```

#### 2. Real-time Listener (Lines 62-123)
```typescript
// Watches for changes to ANY of these document types:
const listenerQuery = '*[_type in ["kioskSettings", "menuBoard", "menuItem"]]'

client.listen(listenerQuery).subscribe({
  next: (update) => {
    // Ignores draft documents (only published changes trigger updates)
    // Debounces re-fetch by 500ms to avoid race conditions
    // Re-fetches full menu data on any change
  }
})
```

**Key behaviors:**
- **Debouncing**: 500ms delay between receiving update and re-fetching (prevents thrashing)
- **Draft filtering**: Ignores `drafts.*` documents - only published changes update the menu
- **Full re-fetch**: Always fetches complete menu state (not partial updates)
- **Offline resilience**: Maintains `lastGoodDataRef` to show cached data if connection drops

#### 3. Client Configuration (`src/lib/sanity.ts`)

```typescript
export const client = createClient({
  useCdn: false,         // CRITICAL: Disables CDN for real-time updates
  perspective: 'published' // Only fetches published documents (not drafts)
})
```

**⚠️ Important:** `useCdn: false` is **required** for real-time updates. If `true`, updates may be delayed by CDN caching (up to 60 seconds).

### Update Flow Diagram

```
Sanity Studio
    ↓ (publishes change to menuItem)
    ↓
Listener detects mutation
    ↓ (check: is it published?)
    ↓ YES
Debounce timer starts (500ms)
    ↓ (additional changes extend timer)
    ↓ Timer expires
Re-fetch full ACTIVE_BOARD_QUERY
    ↓
Update React state
    ↓
Menu re-renders with new data
```

### Availability Override System

The app supports a **3-tier priority system** for item availability (implemented in `MenuItem.tsx:15-28`):

```typescript
// Priority 1: Per-item override (highest priority)
if (availabilityOverride === 'always-available') return true
if (availabilityOverride === 'force-unavailable') return false

// Priority 2: Global ignore stock levels
if (ignoreStockLevels) return true

// Priority 3: Use inventory status (lowest priority)
return isAvailable
```

**Use cases:**
- `availabilityOverride: 'always-available'` - Show item even if inventory says out of stock
- `availabilityOverride: 'force-unavailable'` - Hide item even if in stock (e.g., temporarily removed)
- `ignoreStockLevels: true` (global) - Show all items regardless of inventory
- `use-inventory` - Default behavior, respects `isAvailable` field

### Debugging Real-time Sync

The hook logs detailed information to the browser console:

```
🔧 Setting up Sanity listener
  Watching document types: kioskSettings, menuBoard, menuItem
  Perspective: published
  CDN Disabled: true

📡 Received update from Sanity: { type, documentId, mutations }
⏭️ Skipping draft update: drafts.abc123
🔄 Re-fetching menu data...
✅ Menu data updated successfully
```

**Common issues:**
- Updates not appearing? Check console for `⏭️ Skipping draft update` (you need to **publish** in Sanity Studio)
- Slow updates? Check `useCdn: false` in `sanity.ts`
- Connection errors? Look for `❌ Listener error` in console

### GROQ Query Structure

The `ACTIVE_BOARD_QUERY` in `src/lib/sanity.ts` fetches all menu data:

```groq
*[_type == "kioskSettings"] {
  announcementBar,
  ignoreStockLevels,
  activeBoard-> {                    # Dereference the board reference
    title,
    slug,
    sections[] {                     # Array of sections
      heading,
      items[]-> {                    # Dereference item references
        _id,
        title,
        price,
        isAvailable,
        availabilityOverride,
        marketingDescription,
        dietaryTags,
        image {
          asset-> { url }            # Dereference image asset
        }
      }
    }
  }
}
```

**Key points:**
- `->` operator dereferences references (follows relationships)
- Query returns an array (required for listener to work correctly)
- No `[0]` in query - the hook extracts first element
- Fetches complete nested structure in one query (no N+1 problems)

## Customization

### Adjust Column Layout

Edit `BoardLayout.tsx` (lines 56-61) to modify the multi-column layout:

```tsx
<div style={{
  columnCount: 'auto',
  columnWidth: '28rem',  // Minimum width per column
  columnGap: '4rem',     // Space between columns
  height: '100%'
}}>
```

**Tips:**
- Increase `columnWidth` for wider columns (fewer columns)
- Decrease `columnGap` to fit more columns on screen
- Use `columnCount: 3` to force exactly 3 columns (instead of `'auto'`)

### Adjust Spacing Between Menu Items

Edit `CategoryColumn.tsx` (lines 32-37) to change gap between items:

```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'  // Change this value (currently 12px)
}}>
```

Or edit `MenuItem.tsx` (line 40) to use margin-bottom:

```tsx
style={{
  // ... existing styles
  marginBottom: '1rem'  // Change this value
}}
```

### Change Sold-Out Behavior

Edit `MenuItem.tsx:33-34` to modify opacity or hide items:

```tsx
// Option 1: Current behavior - 40% opacity
className={!finalIsAvailable ? 'opacity-40' : ''}

// Option 2: More subtle - 70% opacity
className={!finalIsAvailable ? 'opacity-70' : ''}

// Option 3: Hide completely
if (!finalIsAvailable) return null
```

### Modify Color Theme

Edit individual component files (inline styles) or `src/index.css` (@theme section, lines 21-53):

```css
@theme {
  --color-dark-bg: #0a0a0a;
  --color-light-text: #ffffff;
  --color-accent-pink: #ff4d9f;   /* Section headers */
  --color-accent-green: #7ed957;  /* Prices */
  --color-warning: #fbbf24;       /* Sold out badge */
}
```

**Note:** Color variables in `index.css` are primarily for reference. Most colors are hardcoded in component inline styles for reliability.

## Troubleshooting

### Menu not loading?

1. Check environment variables are set correctly
2. Verify Sanity project ID and dataset name
3. Ensure an active board is configured in Kiosk Settings
4. Check browser console for errors

### Items not updating in real-time?

1. Verify `useCdn: false` in `src/lib/sanity.ts`
2. Check Sanity listener connection in browser console
3. Ensure document is published (not draft) in Sanity Studio

### Display looks wrong on projector?

1. Ensure projector is set to native resolution
2. Check viewport units are rendering correctly
3. Adjust font size variables in `src/index.css:13-19`

### Styles not applying?

1. **Use inline styles, not Tailwind classes** for spacing/colors/typography
2. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to clear cache
3. Check browser DevTools → Elements tab to see actual rendered styles
4. Verify Vite dev server is running and hot reload is working

## Developer Notes

### Important Patterns & Gotchas

1. **Always use inline styles for visual properties**
   - Spacing, colors, fonts, sizes should use `style={{}}` props
   - Tailwind classes are only reliable for layout structures
   - See "Styling Architecture" section above for details

2. **Sanity schema requirements**
   - `kioskSettings` must be a singleton (only one document)
   - `activeBoard` reference must point to a published `menuBoard`
   - Menu items must be published (not drafts) to appear in the app

3. **React StrictMode compatibility**
   - The `useMenuData` hook guards against double-subscription in dev mode
   - Subscription cleanup properly handles StrictMode double-mounting

4. **Multi-column layout behavior**
   - Categories flow into columns based on available width
   - `breakInside: 'avoid'` prevents categories from splitting across columns
   - Changing column gap/width may affect how many columns appear

5. **Viewport units for projector scaling**
   - All sizes use `vw` units for consistent scaling across resolutions
   - Test on actual projector hardware - viewport math differs from regular monitors
   - 1920x1080 projector typical reference resolution

6. **Performance considerations**
   - Real-time listener is persistent (one WebSocket connection)
   - 500ms debounce prevents excessive re-fetches during bulk edits
   - Full menu re-fetch on each change (simple, avoids partial state issues)

### Testing Real-time Updates

1. Start the dev server: `npm run dev`
2. Open browser to `http://localhost:5173`
3. Open browser DevTools → Console
4. Open Sanity Studio in another tab
5. Publish a change to a menu item
6. Watch console logs for sync flow:
   ```
   📡 Received update from Sanity
   🔄 Re-fetching menu data...
   ✅ Menu data updated successfully
   ```

### Contributing

When submitting PRs:
- Follow the inline styles pattern for reliability
- Add console logs for debugging (use emoji prefixes like existing code)
- Test with actual Sanity Studio changes, not just mock data
- Verify changes work on a projector or large display if possible

## License

MIT
