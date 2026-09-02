# Releasing

Maintainer-facing guide. **Never bump versions, tags, or `server.json` manually** — everything is derived from [Conventional Commits](https://www.conventionalcommits.org/) since the last tag by [release-it](https://github.com/release-it/release-it):

- `fix:` → patch · `feat:` → minor · `feat!:` / `BREAKING CHANGE:` → major
- Other types (`docs:`, `chore:`, `refactor:`, `ci:`, ...) do **not** bump on their own; a release including only those needs an explicit patch via a `fix:`/`feat:` companion commit.

## Cutting a release

```bash
pnpm run release          # interactive release
pnpm run release:dry-run  # preview the whole plan, changes nothing
```

What release-it does locally:

1. Rebuilds `dist/` (`rm -rf dist && npm run build`, via the `before:init` hook)
2. Bumps `package.json` **and both `version` fields in `server.json`** (`@release-it/bumper`, path array `["version", "packages.0.version"]`)
3. Generates `CHANGELOG.md` from commits (`@release-it/conventional-changelog`)
4. Commits `chore(release): x.y.z` → tags `vx.y.z` → pushes with `--follow-tags`

## What CI does (automatic)

The `v*` tag push triggers [`.github/workflows/publish-mcp.yml`](../.github/workflows/publish-mcp.yml):

1. `npm ci` → tests (`--if-present`) → build
2. **npm publish** via OIDC trusted publishing — no `NODE_AUTH_TOKEN`, no secrets
3. **MCP Registry publish** — installs `mcp-publisher`, authenticates with `login github-oidc` (short-lived token, nothing to rotate), runs `mcp-publisher publish`

Monitor a run: `gh run watch` (or the Actions tab). Verify afterwards:

```bash
npm view mcp-baserow-schema version
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.aficiomaquinas/mcp-baserow-schema"
```

## One-time setup (already done)

- **npm trusted publisher** — package Settings → Trusted Publisher on npmjs.com: GitHub Actions, `aficiomaquinas/mcp-baserow-schema`, workflow `publish-mcp.yml`, allowed action `npm publish`. Requirement: publish-time npm CLI ≥ 11.5.1 / Node ≥ 22.14 — the workflow pins Node 24.
- **MCP Registry** — nothing to configure; `mcp-publisher login github-oidc` mints its own token from the workflow's OIDC claims.

## Gotchas

- **Interleaved version error on npm publish** — the trusted publisher binds npm to the exact `repo`+`workflow` pair; renaming either requires updating the npm-side config.
- **`Empty changeset`** — a bump with no file changes means release-it had nothing to commit; usually the version files were already bumped (check `git status` before rerunning).
- **2FA security setting** — npm is restricting bypass-2FA granular tokens (Aug 2026) and deprecating them (Jan 2027). Trusted publishing is unaffected; do not go back to tokens.
