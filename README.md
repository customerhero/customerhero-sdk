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

This repo uses [Changesets](https://github.com/changesets/changesets) to version and publish. To contribute a release:

```bash
npx changeset       # describe your change; pick a version bump
git commit -am "feat: ..."
git push
```

On merge to `main`, CI opens a "Version Packages" PR. Merging that PR publishes the packages to npm with provenance.

## License

MIT
