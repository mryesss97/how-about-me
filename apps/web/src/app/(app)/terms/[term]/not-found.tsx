import { ArrowLeft } from "@untitledui/icons";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { PageFrame } from "@/features/shared/page-frame";

const copy = {
  title: "Cụm từ không hợp lệ",
  body: "Cụm từ cần 1–60 ký tự và có ít nhất một chữ hoặc số.",
  back: "Trang chủ",
};

/** Invalid `/terms/<term>` (#350): rendered inside the app shell. Term rules BR-041/BR-042. */
export default function TermNotFound() {
  return (
    <PageFrame>
      <div className="operate-board relative">
        <span aria-hidden className="sign-keyline" />
        <div className="relative flex flex-col items-start gap-4 p-6 sm:p-8">
          <h1 className="page-fascia-title">{copy.title}</h1>
          <p className="text-md text-tertiary">{copy.body}</p>
          <PlaqueButton size="md" href="/" iconLeading={ArrowLeft}>
            {copy.back}
          </PlaqueButton>
        </div>
      </div>
    </PageFrame>
  );
}
