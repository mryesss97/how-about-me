import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { threadsStatusFixture } from "../test-fixtures";
import { UpdateTokenDialog } from "./update-token-dialog";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const FAKE = "fake-token-for-tests-0123456789";
const onClose = vi.fn();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const tokenInput = () => screen.getByLabelText(/Access token/) as HTMLInputElement;

beforeEach(() => {
  apiFetch.mockReset();
  onClose.mockReset();
});

describe("UpdateTokenDialog", () => {
  it("TC-INT-012: token field is a password input and never prefilled, also after reopen", () => {
    const { rerender } = render(<UpdateTokenDialog pid={P1} isOpen onClose={onClose} />, { wrapper });
    expect(tokenInput().type).toBe("password");
    expect(tokenInput().value).toBe("");
    fireEvent.change(tokenInput(), { target: { value: "typed-something" } });
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    rerender(<UpdateTokenDialog pid={P1} isOpen={false} onClose={onClose} />);
    rerender(<UpdateTokenDialog pid={P1} isOpen onClose={onClose} />);
    expect(tokenInput().value).toBe("");
  });

  it("rejects a short token without calling the API", async () => {
    render(<UpdateTokenDialog pid={P1} isOpen onClose={onClose} />, { wrapper });
    fireEvent.change(tokenInput(), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu token" }));
    expect(await screen.findByText("Token phải dài 20–4096 ký tự.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-043: PUTs the body and leaves no token in the DOM", async () => {
    apiFetch.mockResolvedValue(threadsStatusFixture({ status: "disconnected" }));
    render(<UpdateTokenDialog pid={P1} isOpen onClose={onClose} />, { wrapper });
    fireEvent.change(tokenInput(), { target: { value: FAKE } });
    fireEvent.change(screen.getByLabelText(/Tài khoản/), { target: { value: "@brand" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu token" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/integrations/threads`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ accessToken: FAKE, accountIdentifier: "@brand" });
    expect(tokenInput().value).toBe("");
    expect(document.body.innerHTML).not.toContain(FAKE);
  });
});
