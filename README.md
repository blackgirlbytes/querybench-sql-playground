# Querybench

A local SQL playground for interview practice. It runs SQLite in your browser, so no account, API key, or database server is needed.

## Run

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Practice

- Start with four related tables: `customers`, `products`, `orders`, and `order_items`.
- Write and run any SQLite query. Use `⌘/Ctrl + Enter` as a shortcut.
- Inspect query results and table structure. SQL errors appear beside the results.
- Choose **Create a table**, enter a name, and define its columns. Generate sample rows using automatic values, lists of choices, or numeric ranges.
- For an exact dataset, choose **Paste exact rows** and paste CSV with a header. The playground uses the headers as column names and infers their types. For example, paste the following into a new table named `race_results`.

  ```csv
  runner,event,finish_seconds
  Ari,100m,12.4
  Morgan,100m,11.9
  Ari,200m,25.1
  ```

- To add another batch, select your table and click **Generate data**. **Customize rows** lets you edit its generation rules or append exact rows. You can also create tables in the SQL editor.
- Changes are saved in this browser's local storage. **Reset database** restores the starter data.

The generator handles common columns and SQLite foreign keys. Tables with special constraints may require manual INSERT statements.

## Deploy

This is a static Vite app. No backend or environment variables are needed.

- **Vercel:** Import the GitHub repository as a new project. Vercel detects Vite; use `npm run build` and `dist` if it asks for the build command and output directory.
- **GitHub Pages:** Push the repository to GitHub, then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The included workflow deploys on pushes to `main`. The Vite build uses relative asset paths so the app also works at a repository subpath.

Browser data is stored in each visitor's own local storage. It does not sync between devices or visitors.

## Verify

```bash
npm test
npm run build
```
