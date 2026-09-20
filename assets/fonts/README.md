# Self-hosted fonts

Every font the client names is served from here. Nothing is fetched from a CDN,
and `tests/styles/Fonts.spec.ts` fails if that changes.

That matters more than it looks. A card is a fixed pixel box drawn for Ubuntu's
metrics, and card titles are fitted by measuring the rendered text, so both assume
the font the stylesheet names is the font the browser actually has. When Ubuntu was
fetched from Google Fonts by a `<link>` in `index.html`, any request that was slow,
blocked, or simply not there — the game is an installable PWA, so offline is a
normal state — redrew every card in the platform's own sans-serif, whose wider
glyphs spill past boxes that were never measured for them.

The faces are declared in `src/styles/common.less` and cached by the service
worker along with the rest of `assets/`.

| File | Family | Weight | Subset |
| --- | --- | --- | --- |
| `ubuntu-latin.woff2` | Ubuntu | 400 | latin |
| `ubuntu-latin-ext.woff2` | Ubuntu | 400 | latin-ext |
| `ubuntu-cyrillic.woff2` | Ubuntu | 400 | cyrillic |
| `ubuntu-cyrillic-ext.woff2` | Ubuntu | 400 | cyrillic-ext |
| `ubuntu-bold-latin.woff2` | Ubuntu | 700 | latin |
| `ubuntu-bold-latin-ext.woff2` | Ubuntu | 700 | latin-ext |
| `ubuntu-bold-cyrillic.woff2` | Ubuntu | 700 | cyrillic |
| `ubuntu-bold-cyrillic-ext.woff2` | Ubuntu | 700 | cyrillic-ext |
| `archivo-latin.woff2` | Archivo, variable weight 400–700 | — | latin |
| `archivo-latin-ext.woff2` | Archivo, variable weight 400–700 | — | latin-ext |
| `plex-mono-latin.woff2` | IBM Plex Mono | 400 | latin |
| `plex-mono-latin-ext.woff2` | IBM Plex Mono | 400 | latin-ext |

Ubuntu ships in both weights because card titles ask for `font-weight: bold`. With
only the regular face loaded the browser draws a synthetic bold, which is the
regular face smeared wider — wider than the box the title was fitted to.

The Cyrillic subsets are there for the `bg`, `ru` and `ua` locales. Scripts outside
these subsets (CJK) fall back to the platform font, as they always have.

## Licences

- Ubuntu — Canonical, [Ubuntu Font Licence 1.0](https://ubuntu.com/legal/font-licence)
- Archivo — Omnibus-Type, SIL Open Font License 1.1, <https://github.com/Omnibus-Type/Archivo>
- IBM Plex Mono — IBM, SIL Open Font License 1.1, <https://github.com/IBM/plex>

Archivo, IBM Plex Mono and Ubuntu are the Google Fonts subsets, taken from
`fonts.googleapis.com` once and committed here.
