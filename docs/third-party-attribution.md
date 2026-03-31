# Third-Party Attribution

This project uses the following open-source dependencies. All are free to use
under their respective licenses.

## Runtime Dependencies

| Package | License | Repository |
|---------|---------|------------|
| [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) | MIT | [WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| [electron](https://www.npmjs.com/package/electron) | MIT | [electron/electron](https://github.com/electron/electron) |
| [music-metadata](https://www.npmjs.com/package/music-metadata) | MIT | [borewit/music-metadata](https://github.com/borewit/music-metadata) |
| [react](https://www.npmjs.com/package/react) | MIT | [facebook/react](https://github.com/facebook/react) |
| [react-dom](https://www.npmjs.com/package/react-dom) | MIT | [facebook/react](https://github.com/facebook/react) |
| [zod](https://www.npmjs.com/package/zod) | MIT | [colinhacks/zod](https://github.com/colinhacks/zod) |

## Dev Dependencies

| Package | License | Repository |
|---------|---------|------------|
| [@electron/rebuild](https://www.npmjs.com/package/@electron/rebuild) | MIT | [electron/rebuild](https://github.com/electron/rebuild) |
| [@types/better-sqlite3](https://www.npmjs.com/package/@types/better-sqlite3) | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| [@types/node](https://www.npmjs.com/package/@types/node) | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| [@types/react](https://www.npmjs.com/package/@types/react) | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| [@typescript-eslint/eslint-plugin](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) | MIT | [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) |
| [@typescript-eslint/parser](https://www.npmjs.com/package/@typescript-eslint/parser) | BSD-2-Clause | [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | MIT | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| [concurrently](https://www.npmjs.com/package/concurrently) | MIT | [open-cli-tools/concurrently](https://github.com/open-cli-tools/concurrently) |
| [cross-env](https://www.npmjs.com/package/cross-env) | MIT | [kentcdodds/cross-env](https://github.com/kentcdodds/cross-env) |
| [esbuild](https://www.npmjs.com/package/esbuild) | MIT | [evanw/esbuild](https://github.com/evanw/esbuild) |
| [eslint](https://www.npmjs.com/package/eslint) | MIT | [eslint/eslint](https://github.com/eslint/eslint) |
| [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) | MIT | [facebook/react](https://github.com/facebook/react) |
| [markdownlint-cli](https://www.npmjs.com/package/markdownlint-cli) | MIT | [igorshubovych/markdownlint-cli](https://github.com/igorshubovych/markdownlint-cli) |
| [tsx](https://www.npmjs.com/package/tsx) | MIT | [privatenumber/tsx](https://github.com/privatenumber/tsx) |
| [typescript](https://www.npmjs.com/package/typescript) | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| [vite](https://www.npmjs.com/package/vite) | MIT | [vitejs/vite](https://github.com/vitejs/vite) |
| [vitest](https://www.npmjs.com/package/vitest) | MIT | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| [wait-on](https://www.npmjs.com/package/wait-on) | MIT | [jeffbski/wait-on](https://github.com/jeffbski/wait-on) |

## iPod Format References

The iTunesDB binary parser (`electron/services/ipod/itunesDbParser.ts`) is based
on community-documented reverse-engineering of the iPod database format. No Apple
proprietary code or libraries are used. Key references:

- [iPodLinux iTunesDB documentation](http://www.ipodlinux.org/ITunesDB/)
- [iPodLinux SysInfo documentation](http://www.ipodlinux.org/SysInfo.html)

## Release Checklist

Before each release, review license compatibility for newly added dependencies
and keep this file, `NOTICE`, and license references accurate.
