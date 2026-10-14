/**
 * #250: soft navigation to `/mentions` (e.g. a key-phrase chip inside the intercepted slide-out) must match the
 * `@detail` slot to null, otherwise Next keeps the active slide-out open (Parallel Routes → closing the modal).
 * `default.tsx` only covers hard loads.
 */
export default function Page() {
  return null;
}
