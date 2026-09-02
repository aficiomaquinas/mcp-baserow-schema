# Changelog

## [2.0.2](https://github.com/aficiomaquinas/mcp-baserow-schema/compare/v2.0.1...v2.0.2) (2026-09-02)

### Bug Fixes

* **release:** bump patch for docs, refactor, and perf commits ([9f80f7b](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/9f80f7b3098dd2207c890954345001c07986c99d))

### Documentation

* move releasing guide to docs/RELEASING.md, drop v1 migration notes ([12ac74d](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/12ac74d517b4da0f089764186322a2a3988f3c43))
* remove local publish fallback from releasing guide ([6be6434](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/6be6434907fc30aeee858c46d7fea4fd5dc51cde))
* replace real Baserow URL with example.com placeholder in setup examples ([ce8c512](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/ce8c512562c48b32b2081262a82deb862b86010c))

### Refactoring

* **server:** read serverInfo version from package.json instead of hardcoding ([2b606b0](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/2b606b01b43c68e332399c197f24c83bdffdc8bd))

## [2.0.1](https://github.com/aficiomaquinas/mcp-baserow-schema/compare/v2.0.0...v2.0.1) (2026-09-02)

### Bug Fixes

* **npm:** add bin entry and node shebang so npx mcp-baserow-schema works ([957ffa5](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/957ffa5a86f4de55b009e8ec8428a3676333f6d8))
* **spec:** use numeric-only regex for path params to avoid false matches ([8c132b2](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/8c132b269329bd034df7cf0e6d625e5ea7caa716))

### Documentation

* document release-it workflow and add release scripts ([d10cf26](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/d10cf263337ef868b33baa7aea60a6756297d1e7))
* update README for v2 generic baserow_api tool (16 tools removed) ([bea46f3](https://github.com/aficiomaquinas/mcp-baserow-schema/commit/bea46f3ce9b5e2da8f389ac33a971db5720f916d))
