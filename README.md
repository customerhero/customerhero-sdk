# CustomerHero SDKs

Official JavaScript and React SDKs for [CustomerHero](https://customerhero.app).

## Packages

| Package                                   | Version                                                                                                           | Description                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| [`@customerhero/js`](./packages/js)       | [![npm](https://img.shields.io/npm/v/@customerhero/js.svg)](https://www.npmjs.com/package/@customerhero/js)       | Framework-agnostic JavaScript client |
| [`@customerhero/react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@customerhero/react.svg)](https://www.npmjs.com/package/@customerhero/react) | React components                     |

## Development

```bash
npm install
npm test
npm run build
```

## Releasing

Releases are published manually from a maintainer's machine. [Changesets](https://github.com/changesets/changesets) is used for version bumps and changelog generation.

```bash
# 1. Record your change and pick a version bump
npx changeset

# 2. Apply the pending changesets (bumps versions, updates CHANGELOG.md)
npm run version-packages

# 3. Commit the version bump
git add -A && git commit -m "chore: version packages" && git push

# 4. Publish to npm (builds first, then publishes via changeset publish)
npm login          # only needed once
npm run release
```

`npm run release` runs `npm run build` then `changeset publish`, which publishes any package whose version isn't yet on the registry.

## License

MIT
