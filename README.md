# Querybench

A local SQL playground for interview practice. It runs SQLite in your browser, so no account, API key, or database server is needed.

## Run

From the repository root:

```bash
npm install
npm run dev:sql
```

Open the local URL printed by Vite.

## Practice

- Start with four related tables: `customers`, `products`, `orders`, and `order_items`.
- Write and run any SQLite query. Use `⌘/Ctrl + Enter` as a shortcut.
- Inspect query results and table structure. SQL errors appear beside the results.
- Choose a table and a row count under **Data generator**, then click **Generate data**. The generator uses column names and types to make sample values and selects existing keys for foreign key columns.
- Create your own table with a `CREATE TABLE` statement, then select it in the generator. Add referenced parent rows before generating child rows.
- Changes are saved in this browser's local storage. **Reset database** restores the starter data.

The generator handles common columns and SQLite foreign keys. Tables with special constraints may require manual INSERT statements.

## Deploy

This is a static Vite app. No backend or environment variables are needed.

- **Vercel:** Import the GitHub repository as a new project. Vercel detects Vite; use `npm run build` and `dist` if it asks for the build command and output directory.
- **GitHub Pages:** Push the repository to GitHub, then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The included workflow deploys on pushes to `main`. The Vite build uses relative asset paths so the app also works at a repository subpath.

Browser data is stored in each visitor's own local storage. It does not sync between devices or visitors.

## Verify

```bash
npm test -w sql-playground
npm run build -w sql-playground
```
