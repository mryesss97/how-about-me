import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { restrictedImportPatterns } from "@how-about-me/eslint-config/base";
import next from "@how-about-me/eslint-config/next";

// Feature import boundaries (docs/02-architecture/03-frontend-design.md §1, #236).
// Folders are read from disk so new features are protected automatically.
const featuresDir = fileURLToPath(new URL("./src/features", import.meta.url));
const features = readdirSync(featuresDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const SHARED = ["shared", "auth"];

/** One block per feature: it may import itself, `shared` and `auth` only. */
const featureBoundaries = features.map((feature) => {
  const allowed = new Set([feature, ...SHARED]);
  const forbidden = features.filter((f) => !allowed.has(f));
  return {
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      // Overrides base options, so base package-boundary patterns are repeated.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...restrictedImportPatterns,
            ...(forbidden.length
              ? [
                  {
                    regex: `^(@/features/|(\\.\\./)+)(${forbidden.join("|")})(/|$)`,
                    message:
                      "Feature folders must not import other features; use features/shared, features/auth or lib/ (docs/02-architecture/03-frontend-design.md §1).",
                  },
                ]
              : []),
          ],
        },
      ],
    },
  };
});

export default [
  ...next,
  ...featureBoundaries,
  // Vendored Untitled UI components keep upstream style; lint our code only.
  {
    ignores: [
      ".next/**",
      "src/components/**",
      "src/hooks/**",
      "src/utils/**",
      "src/providers/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];
