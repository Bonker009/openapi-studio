# License artifacts

| File | Description |
|------|-------------|
| `npm-production.csv` | Production npm dependency names, SPDX-style licenses, repositories |
| `plus-jakarta-sans-OFL.txt` | Font copyright + OFL reference (full OFL in npm package) |

Regenerate the CSV from the repo root:

```bash
npm run licenses:report --prefix apps/api-spector-spa
```
