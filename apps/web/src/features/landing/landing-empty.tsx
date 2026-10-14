import Link from "next/link";
import { landingCopy as copy } from "./copy";

/** No landing terms configured (#262): admins get a link to Settings, other roles a neutral line. */
export function LandingEmpty({ admin }: { admin: boolean }) {
  return (
    <p className="relative z-10 text-sm text-tertiary">
      {admin ? (
        <Link
          href="/settings/project"
          className="font-semibold text-brand-secondary underline-offset-2 hover:underline"
        >
          {copy.emptyAdmin}
        </Link>
      ) : (
        copy.emptyOther
      )}
    </p>
  );
}
