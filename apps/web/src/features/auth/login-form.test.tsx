import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXPIRED_NOTICE, FORBIDDEN_NOTICE, LOGIN_ERROR, LoginForm } from "./login-form";
import { safeNext } from "./safe-next";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signInWithOAuth = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signInWithOAuth } }),
}));

function submit() {
  fireEvent.change(screen.getByLabelText(/^e-mail/i, { selector: "input" }), { target: { value: "a@b.co" } });
  fireEvent.change(screen.getByLabelText(/^mật khẩu/i, { selector: "input" }), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("LoginForm (FR-010)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("#350: password input has no placeholder and submit reads 'Đăng nhập'", () => {
    render(<LoginForm googleEnabled={false} />);
    expect(screen.getByLabelText(/^mật khẩu/i, { selector: "input" })).not.toHaveAttribute("placeholder");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toHaveAttribute("type", "submit");
  });

  it("TC-AUTH-002: wrong password shows a generic error and does not redirect", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm googleEnabled={false} />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_ERROR);
    expect(replace).not.toHaveBeenCalled();
  });

  it("TC-AUTH-001: success goes to / (landing, #262)", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm googleEnabled={false} />);
    submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.co", password: "secret123" });
  });

  it("honours a safe next and ignores an open redirect", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const { unmount } = render(<LoginForm googleEnabled={false} next="//evil.com" />);
    submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    unmount();
    render(<LoginForm googleEnabled={false} next="/mentions?x=1" />);
    submit();
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/mentions?x=1"));
  });

  it("TC-AUTH-004: has no sign-up link", () => {
    render(<LoginForm googleEnabled />);
    expect(
      screen.queryByRole("link", { name: /sign up|register|create account|đăng ký|tạo tài khoản/i }),
    ).not.toBeInTheDocument();
  });

  it("FR-012: Google button follows the flag", () => {
    const { rerender } = render(<LoginForm googleEnabled={false} />);
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    rerender(<LoginForm googleEnabled />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("TC-AUTH-008: shows the expired banner", () => {
    render(<LoginForm googleEnabled={false} reason="expired" />);
    expect(screen.getByRole("status")).toHaveTextContent(EXPIRED_NOTICE);
  });

  it("#286: shows the forbidden banner (text carries meaning, BR-017)", () => {
    render(<LoginForm googleEnabled={false} reason="forbidden" />);
    expect(screen.getByRole("status")).toHaveTextContent(FORBIDDEN_NOTICE);
  });
});

describe("safeNext", () => {
  it.each([
    [undefined, "/"],
    ["//evil.com", "/"],
    ["https://evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/\t/evil.com", "/"],
    ["/login", "/"],
    ["/login?next=/x", "/"],
    ["/auth/callback", "/"],
    ["/mentions", "/mentions"],
    ["/mentions?q=1&tz=Asia%2FHo_Chi_Minh", "/mentions?q=1&tz=Asia%2FHo_Chi_Minh"],
  ])("%s → %s", (input, out) => expect(safeNext(input)).toBe(out));
});
