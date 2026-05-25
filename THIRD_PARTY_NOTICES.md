# Third-party notices

api-spector is licensed under the **MIT License** (see [LICENSE](LICENSE)).
This document lists material bundled in published artifacts or required at runtime.

---

## Published JAR contents

| Artifact | What is bundled |
|----------|-----------------|
| `api-spector-webjar` | Built SPA (`apps/api-spector-spa/dist`), including npm dependencies and web fonts |
| `api-spector-spring-boot-starter` | Java auto-configuration + repackages notices; depends on webjar and scanner |
| `api-spector-scanner` | Java library only (no frontend) |

Copies of this file, `NOTICE`, and `licenses/*` are packaged under `META-INF/` in webjar and starter JARs.

---

## Embedded font (required attribution)

**Plus Jakarta Sans** — SIL Open Font License 1.1 (OFL-1.1)

- Copyright 2020 The Plus Jakarta Sans Project Authors  
  https://github.com/tokotype/PlusJakartaSans  
- Bundled through `@fontsource/plus-jakarta-sans` in the playground UI  
- Full license text: [licenses/plus-jakarta-sans-OFL.txt](licenses/plus-jakarta-sans-OFL.txt)

The font must remain under OFL when distributed; it is not licensed as MIT.

---

## Bundled JavaScript (WebJar / SPA build)

The UI is built with **Vite** and includes production npm dependencies (React, Radix UI, shadcn-style components, CodeMirror, ExcelJS, Lucide icons, etc.).

A machine-readable list of **330** production packages is in:

- [licenses/npm-production.csv](licenses/npm-production.csv)

Regenerate after dependency changes:

```bash
npm run licenses:report --prefix apps/api-spector-spa
```

### Direct production dependencies (summary)

| Package | License | Use |
|---------|---------|-----|
| react, react-dom | MIT | UI framework |
| @radix-ui/* | MIT | Accessible UI primitives |
| lucide-react | ISC | Icons |
| exceljs | MIT | Excel export |
| @codemirror/*, @uiw/react-codemirror | MIT | JSON editor |
| @fontsource/plus-jakarta-sans | OFL-1.1 | UI font |
| react-syntax-highlighter, highlight.js | MIT / BSD-3-Clause | Syntax highlighting |
| tailwind-merge, class-variance-authority, zod, etc. | MIT / Apache-2.0 | UI utilities |

### Dual-licensed transitive dependency

**jszip** (via exceljs) — **MIT OR GPL-3.0-or-later**  
This distribution relies on the **MIT** license option. It is not licensed under GPL for this project.

---

## Java runtime dependencies (Maven)

These are **not** shaded into the JAR; they are declared Maven dependencies resolved by the consumer’s build:

| Component | License |
|-----------|---------|
| Spring Boot / Spring Framework | Apache-2.0 |
| Jackson | Apache-2.0 |
| victools jsonschema-generator | Apache-2.0 |
| Jakarta Validation API | Apache-2.0 |

See each project for full license texts.

---

## UI components

Files under `apps/api-spector-spa/src/components/ui/` follow the [shadcn/ui](https://ui.shadcn.com/) pattern (typically MIT) and use [Radix UI](https://www.radix-ui.com/) (MIT).

---

## Trademarks

“Spring”, “Spring Boot”, “Swagger”, and “Postman” are trademarks of their respective owners. api-spector is not affiliated with or endorsed by them.
