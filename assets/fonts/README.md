# Menu fonts

Self-hosted subsets used by the start screen, the continue-game screen and the
create-game form. They are declared in `src/styles/common.less` and served from
`assets/fonts/` — nothing here is fetched from a CDN, so the menus render the
same offline as online.

| File | Family | Subset |
| --- | --- | --- |
| `archivo-latin.woff2` | Archivo, variable weight 400–700 | latin |
| `archivo-latin-ext.woff2` | Archivo, variable weight 400–700 | latin-ext |
| `plex-mono-latin.woff2` | IBM Plex Mono, weight 400 | latin |
| `plex-mono-latin-ext.woff2` | IBM Plex Mono, weight 400 | latin-ext |

Both families are licensed under the SIL Open Font License 1.1.

- Archivo — Omnibus-Type, <https://github.com/Omnibus-Type/Archivo>
- IBM Plex Mono — IBM, <https://github.com/IBM/plex>

Scripts outside these subsets (Cyrillic, CJK) fall back to the body font, as
they did before these were added.
