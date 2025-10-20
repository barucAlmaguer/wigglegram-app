# Wigglegram App

Create playful wigglegrams by combining a pair of photos taken from slightly different perspectives. The app lets you fine-tune alignment, preview the looping motion, and export a result that feels alive.

## Purpose & Core Flow
- Ingest two source images (typically left/right shots of the same scene).
- Adjust horizontal and vertical offsets until the loop feels natural.
- Export an animated wigglegram GIF built with `gifshot`.

## Prerequisites
- **Node.js** 18 or newer (20 LTS recommended).
- **pnpm** (ships with Node ≥18 via Corepack).
- **Git** for cloning the repository (optional if you download the source directly).

Check your local versions:

```bash
node -v
pnpm -v
```

If the commands are missing or below the required versions, follow the OS-specific setup below.

## Local Development

### macOS & Linux
1. Install Node.js 18+  
   - Using Homebrew: `brew install node`  
   - Or via nvm: `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 20`
2. Enable pnpm through Corepack (recommended):  
   ```bash
   corepack enable pnpm
   ```
   If Corepack is unavailable, install pnpm directly: `npm install -g pnpm`.
3. Clone and enter the project:
   ```bash
   git clone https://github.com/barucAlmaguer/wigglegram-app.git
   cd wigglegram-app
   ```
4. Install dependencies and start the dev server:
   ```bash
   pnpm install
   pnpm run dev
   ```
5. Open the printed local URL (usually `http://localhost:5173`) in your browser.

### Windows
1. Install Node.js 18+  
   - Download the LTS installer from [nodejs.org](https://nodejs.org), or  
   - Use [nvm-windows](https://github.com/coreybutler/nvm-windows) and run `nvm install 20`.
2. Enable pnpm (PowerShell or Command Prompt):
   ```powershell
   corepack enable pnpm
   ```
   If Corepack is not available, install pnpm globally: `npm install -g pnpm`.
3. Clone the repository and navigate into it (PowerShell shown):
   ```powershell
   git clone https://github.com/barucAlmaguer/wigglegram-app.git
   Set-Location wigglegram-app
   ```
4. Install dependencies and start the dev server:
   ```powershell
   pnpm install
   pnpm run dev
   ```
5. Visit the URL displayed by Vite in your browser.

### Already Cloned?
If the project is already on disk, skip the clone step and run the `pnpm` commands inside the project directory.

## Working With the App
- **Load Images:** Drag in or select the two frames captured from a wigglegram-compatible camera or burst.
- **Alignment Controls:** Use the provided sliders/inputs to align the images on both axes so the loop feels cohesive.
- **Preview:** The live preview loops the tween to help you judge parallax.
- **Export:** When satisfied, generate a GIF using the `gifshot` backend.

## Scripts
- `pnpm run dev` – Start the Vite dev server with hot reload (default local workflow).
- `pnpm run build` – Produce an optimized production bundle.
- `pnpm run preview` – Serve the built bundle locally for smoke testing.
- `pnpm run lint` – Run ESLint with the project configuration.

## Deployment (GitHub Pages)
- Pushes to `main` trigger `.github/workflows/deploy.yml`, which installs dependencies with pnpm, builds the production bundle, and publishes it to GitHub Pages.
- In the repository settings, set **Pages** → **Source** to **GitHub Actions** the first time you enable the site.
- The Vite config sets the production base path to `/wigglegram-app/`, so the published site will be available at `https://barucalmaguer.github.io/wigglegram-app/` after the first successful deploy.
- To preview the production build locally before pushing, run `pnpm run build` followed by `pnpm run preview`.

## Troubleshooting
- If `corepack` is not recognized, ensure you're on Node 18+ or install pnpm globally.
- Use `pnpm install --frozen-lockfile` inside CI or to guarantee a clean install.
- Delete the `.pnpm-store` directory if you hit cache corruption errors and reinstall.

## Next Steps
Consider adding automated alignment helpers or presets for common wigglegram capture rigs to speed up the editing process.
