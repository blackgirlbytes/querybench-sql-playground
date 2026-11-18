# Agent instructions for Querybench

This directory is a standalone Vite and React app for SQL interview practice. Use this directory as the working directory for all commands below. It can be published as its own GitHub repository; the parent `interview-practice` folder is not a Git repository.

## Run and verify

1. Check that Node.js 22 or later and npm are available.
2. Run `npm install` in this directory. The app does not need a database server or API key.
3. Run `npm test` and `npm run build`. Fix failures before publishing.
4. Start the app with `npm run dev -- --host 0.0.0.0`. Open the URL Vite prints. Verify that the starter tables appear, a SELECT query returns rows, and **Generate data** adds rows. Stop the development server when finished.

The database runs in the browser through `sql.js` and persists in browser local storage. Resetting the database replaces only the browser's local practice data.

## Push to GitHub

The user requested that this project be pushed to GitHub. Keep it as a separate repository rooted at this directory. Do not add `node_modules`, `dist`, environment files, or credentials.

1. Check `git status` here. If this directory is not yet a repository, run `git init -b main`.
2. Check GitHub CLI authentication with `gh auth status`. If authentication is missing, ask the user to complete `gh auth login`; do not handle or store their credentials yourself.
3. Run `git add .` and `git commit -m "Build SQL interview playground"`. If there is nothing to commit, continue with the existing commit.
4. Check `git remote -v`.
   - If `origin` exists, run `git push -u origin HEAD`.
   - If there is no remote, run `gh repo create querybench-sql-playground --public --source . --remote origin --push`. If that repository name is already taken, choose a clear unused name and report it. Use public visibility for the requested public GitHub Pages site.
5. Confirm the push by checking the remote URL and the latest commit on GitHub with `gh repo view --web` or `gh repo view --json url,defaultBranchRef`. Report the repository URL to the user.

## Deploy

This app can be deployed as static files. `vite.config.js` uses relative asset paths for GitHub Pages repository URLs. Do not add a server or database service for deployment.

- GitHub Pages: After the first push, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. `.github/workflows/pages.yml` builds and deploys on every push to `main`. Check the workflow run and report the Pages URL only when deployment succeeds.
- Vercel: Import the repository in Vercel. Use the Vite preset, `npm run build`, and `dist` as the output directory. Verify the deployment URL before reporting it.

The user has requested GitHub Pages deployment. Complete the Pages setup and verify the live URL after pushing.

If GitHub access is unavailable, finish the local checks and report the exact authentication or access blocker. Do not claim the project was pushed until GitHub confirms it.

## Useful files

- `src/App.jsx`: query editor, results, schema view, and generator controls.
- `src/database.js`: SQLite loading, persistence, and query execution.
- `src/generate.js`: schema-aware sample row generation.
- `src/sample.js`: starter schema, rows, and example queries.
