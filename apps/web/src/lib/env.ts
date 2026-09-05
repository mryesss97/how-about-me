import { z } from "zod";

/** Browser-safe env. Only NEXT_PUBLIC_* may appear here (CI scans the bundle for anything else). */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  NEXT_PUBLIC_API_BASE_URL: z.url(),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().default("Asia/Ho_Chi_Minh"),
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const env = PublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DEFAULT_TIMEZONE: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED,
});
