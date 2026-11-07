# Polka Photobooth

The application source lives in `polka-studio/`. The scripts in this folder forward to that project, so you can run it directly from the repository root.

## Start development

Requires Node.js **22.13 or later**.

```powershell
git clone https://github.com/MarketingAABWSB/polka.git
cd polka
npm install
npm run dev
```

`npm install` installs or repairs the application dependencies inside `polka-studio/`, using its lockfile. You only need to install again if dependencies are missing or changed. The root installer preserves existing packages rather than forcing a clean reinstall.

Before running `npm install` or `npm ci`, stop the dev server with **Ctrl+C** in its terminal. On Windows, a running server locks native modules such as Lightning CSS. The root installer checks for a running photobooth server before changing the application's dependencies.

Open **http://127.0.0.1:5173/** after the terminal prints its Local URL. Keep the terminal running while you use the website.

Use **Enable camera** and allow camera access, or **Try the demo** to test without a webcam.

## Production preview

```powershell
npm run build
npm start
```

`npm start` previews an existing production build; use `npm run dev` for normal development.

## Repair an interrupted installation

If you see `EPERM` for a file in `node_modules`, stop this project's running dev server first. Then run:

```powershell
npm install
```

Wait for installation to finish successfully before starting the server in a separate command:

```powershell
npm run dev
```

An interrupted install can cause `ERR_MODULE_NOT_FOUND` for Vinext; completing `npm install` restores the missing packages. Administrator access is not normally needed.

For app features and implementation details, see [polka-studio/README.md](polka-studio/README.md).

## Deploy to Cloudflare Workers

In your Worker's **Settings > Build**, use these settings for the GitHub repository:

| Setting | Value |
| --- | --- |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |

The root `wrangler.jsonc` points to the built Worker at `polka-studio/dist/server/index.js` and browser assets in `polka-studio/dist/client`. This is a server-backed Worker; it does not produce a static `index.html` for Pages.

The Worker name in `wrangler.jsonc` is `polka`. If your existing Cloudflare Worker has another name, change `name` to match it before deploying.

To deploy manually after signing in to Cloudflare, run `npm run build` and then `npm run deploy`. To validate the upload without publishing, run `npm run deploy -- --dry-run`.
