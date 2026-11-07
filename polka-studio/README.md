# polka. photobooth

A cream-and-cherry polka-dot photobooth inspired by the playful camera experience of Webcam Toy. Built with React, TypeScript, Vinext, and **glfx** for real-time WebGL image effects.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

Open the printed local address (normally `http://127.0.0.1:5173`). Camera access works on localhost or HTTPS. Allow camera access when prompted, or select **Try the demo** to use a local sample photo.

## Features

- Sixteen live effects, including color filters, half-frame mirrors, Quad Mirror, Upside Down, Switch, and Kaleidoscope.
- Left/right arrows cycle through effects. Click the current effect name to open a paged grid of nine live camera previews.
- Mirrored webcam, optional shutter sound, and fullscreen preview.
- Single photos, four-photo strips, and 2 × 2 grids.
- No timer, 3-second countdown, or 5-second countdown for each shot.
- Six frame colors, optional polka dots, and a custom caption.
- High-resolution PNG downloads with filters baked in.
- On phones, the camera and effects browser fill the available screen, with clearly labeled Edit strip and Download actions below.
- Portrait captures and downloads keep the camera's framing, including when rotating during a photo round.
- A gallery for reviewing the current round and removing individual photos.
- Responsive layout, accessible controls and dialogs, and reduced-motion support.
- Canvas 2D color-filter fallback when WebGL is unavailable. Fisheye and Swirl require WebGL for geometric distortion.

Photos are processed locally. They remain in memory for the current tab and are never uploaded. A new round replaces the previous round; download favorites before taking another round, refreshing, or closing the tab. Switching between layouts preserves the round; Single exports its first photo.

## Check and build

```sh
npx tsc --noEmit
npm run build
```

The Sites integration is preserved in `vite.config.ts`, and `.openai/hosting.json` records the registered project. Production output is a Cloudflare Worker in `dist/server/` with browser assets in `dist/client/`.

## Main files

- `app/page.tsx`: photobooth interface and customization.
- `app/globals.css`: responsive polka theme.
- `lib/use-photobooth.ts`: camera lifecycle, live filters, countdown, capture, and fallback.
- `lib/download-strip.ts`: full-resolution strip/grid PNG generation.

Fonts (DM Sans and Playfair Display) and the demo portrait are served locally. The demo portrait is from [Unsplash](https://images.unsplash.com/photo-1524504388940-b1c1722653e1). Effects are powered by [glfx.js](https://github.com/evanw/glfx.js), distributed under the MIT license.
