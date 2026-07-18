# Image generation and export brief

The committed branding is original AI-assisted project artwork. The base illustration was generated
with the built-in OpenAI image-generation capability; no image-generation dependency or credential
is part of this repository. The selected “modular forge” direction was then cropped, composited,
typeset, color-managed, and exported locally. No vendor logo, copied artwork, trademark, or
third-party font binary is included, and the artwork does not imply endorsement or certification.

## Candidate directions

Three internal directions were compared: a diagnostic observatory around a live application, a
connected release-readiness lattice, and a modular precision forge. The forge was selected because
it communicates inspection, strengthening, and evidence without relying on vendor logos or a
cluttered dashboard metaphor. Rejected concepts and temporary generation files are not part of the
repository.

## Production prompt

> Create a premium cinematic 16:9 hero illustration for an open-source developer tool named
> “Fullstack Forge.” Show a central precision engineering forge and intelligent inspection core
> strengthening one connected full-stack system: refined responsive UI layers, backend API paths, a
> relational database with indexed query flows, authentication and authorization shields,
> quarantined file uploads with malware inspection, caching, tests, observability, deployment, and a
> final evidence seal. Suggest that multiple AI coding agents can use the same coordinated system
> without showing third-party logos. Use a dark graphite and slate developer-tool aesthetic,
> restrained cobalt evidence lines and warm ember inspection accents, strong depth, subtle technical
> grids, clean architecture connections, excellent hierarchy, and generous crop-safe negative space.
> Make it trustworthy, premium, production-ready, and coherent rather than a collection of icons.
> Avoid cartoon characters, excessive neon, stock imagery, fake company branding, unreadable
> interfaces, random code, clutter, copied art, trademarks, watermarks, and text inside the
> generated base artwork.

## Export requirements

| Output                                           | Size       | Treatment                                 |
| ------------------------------------------------ | ---------- | ----------------------------------------- |
| `docs/assets/fullstack-forge-hero.png`           | 1600 × 900 | Full composition and README-safe headline |
| `docs/assets/fullstack-forge-social-preview.png` | 1280 × 640 | Wider crop with mobile-safe margins       |
| `docs/assets/fullstack-forge-icon.png`           | 512 × 512  | Recognizable forge/evidence-seal crop     |

Exports use sRGB-compatible PNG, useful contrast, sharp type, and enough negative space for narrow
README rendering. The social asset must preserve all essential information inside GitHub’s safe
area. Rejected generation candidates and source temporaries are not committed.

The color and usage system is documented in [BRAND.md](BRAND.md). The exact human-only GitHub social
preview upload path is documented in [RELEASING.md](RELEASING.md).
