import "@testing-library/jest-dom/vitest";

// Public env defaults so modules importing `@/lib/env` load in unit tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:4000/api/v1";
process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ??= "Asia/Ho_Chi_Minh";
