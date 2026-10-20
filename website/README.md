# LeaseFi documentation

Astro + Starlight, published at https://tomash60.github.io/leasefi/ after deployment.

```sh
npm ci --prefix website
npm run dev --prefix website
```

Production checks:

```sh
npm run check --prefix website
npm run build --prefix website
npm run preview --prefix website
```

Edit pages in `website/src/content/docs/`. Runbooks are sourced from `docs/` by
`scripts/sync-docs.mjs`; restart the dev server after editing them. The local lab
runbook is also split into provider cluster/service/network chapters and tenant
connection/identity/workload/access chapters. Keep its section headings in sync
with the script's extraction markers. The complete native lab remains available
at `guides/local-provider/`; the sidebar leads users through the shorter chapters.
LeaseFi adoption and deployment steps live in `use-leasefi.md` and
`deploy-with-leasefi.md`. Generated
`src/content/docs/guides/` files are ignored and must not be edited directly.

GitHub Actions checks PRs and deploys every push to `main`. Enable **Settings →
Pages → Source → GitHub Actions** once. No tokens or separate deployment branch
are needed. For URL changes, update `site` and `base` in `astro.config.mjs`.
