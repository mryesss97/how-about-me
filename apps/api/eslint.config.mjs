import nest from "@how-about-me/eslint-config/nest";
import { restrictedImportPatterns } from "@how-about-me/eslint-config/base";

/**
 * TC-INT-014 / FR-047: provider implementations and their DTOs/fixtures stay inside `integrations/threads`;
 * everything else injects `SOCIAL_DISCOVERY_PROVIDER` (bound only in `modules/providers`). The neutral
 * interface (`social-discovery.provider`) and the token store/source remain importable.
 */
const threadsInternals = [
  "**/integrations/threads/fake-threads.provider",
  "**/integrations/threads/threads-discovery.provider",
  "**/integrations/threads/threads-http",
  "**/integrations/threads/threads-error.mapper",
  "**/integrations/threads/threads-rate-limit",
  "**/integrations/threads/threads-api.types",
  "**/integrations/threads/__fixtures__/**",
];

export default [
  ...nest,
  { ignores: ["dist/**", "coverage/**", "src/generated/**"] },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/modules/integrations/threads/**", "src/modules/providers/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...restrictedImportPatterns,
            {
              group: threadsInternals,
              message:
                "TC-INT-014 / FR-047: inject SOCIAL_DISCOVERY_PROVIDER; provider DTOs stay in integrations/threads.",
            },
          ],
        },
      ],
    },
  },
];
