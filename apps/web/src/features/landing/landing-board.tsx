import Link from "next/link";
import type { CSSProperties } from "react";
import { cx } from "@/utils/cx";
import { landingCopy as copy } from "./copy";
import { type LandingBoard, boardLabel, boardSplit, boardTone, viRate } from "./landing-data";
import { type BoardRect, type PhraseFit, phraseFit } from "./sign-wall-layout";

type Props = { board: LandingBoard; rect: BoardRect; rank: number; index: number };

/**
 * One enamel signboard (#271): the phrase in straight quotes, its dominant share painted below, a house-number rank
 * plate, and a sub-sign with the full split that slides up on hover/focus. A link to the phrase's detail page (#276),
 * named with the full text (BR-017: colour always with words).
 */
export function SignBoard({ board, rect, rank, index }: Props) {
  const compact = rect.width < 96 || rect.height < 72;
  // BR-017: the share line always shows in full, sized to the board's width; #334: never under 13 px — when one line
  // would need less, it wraps between the share and the label ("62,0%" / "TIÊU CỰC").
  const figure = board.empty ? copy.noMentions : `${viRate(board.dominantShare)} ${copy.sentiment[board.dominant]}`;
  const oneLine = (rect.width - 28) / (figure.length * FIGURE_EM);
  const wrap = oneLine < FIGURE_MIN;
  const cut = figure.indexOf(" ");
  const lines = wrap && cut > 0 ? [figure.slice(0, cut), figure.slice(cut + 1)] : [figure];
  const longest = Math.max(...lines.map((l) => l.length));
  const figureSize = Math.round(
    Math.max(FIGURE_MIN, Math.min(30, rect.height * 0.12, wrap ? (rect.width - 28) / (longest * FIGURE_EM) : oneLine)),
  );
  const textBox = rect.height - figureSize * lines.length - 10;
  // The rank plate stays clear of the phrase: reserve its band only when the first line would reach it.
  let reserveTop = 0;
  let fit = phraseFit(board.name, rect.width, textBox);
  if (collidesWithPlate(fit, rect, figureSize, compact)) {
    reserveTop = compact ? 20 : 28;
    fit = phraseFit(board.name, rect.width, textBox, reserveTop);
  }
  const swing = index % 2 === 0 ? -2.4 : 2.4;
  return (
    <Link
      href={termHref(board.name)}
      aria-label={boardLabel(board)}
      data-tone={boardTone(board)}
      className="sign-board absolute"
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          ["--hang-delay"]: `${index * 55}ms`,
          ["--swing-from"]: `${swing}deg`,
        } as CSSProperties
      }
    >
      <span aria-hidden className="sign-keyline" />
      <span aria-hidden className={cx("sign-plate", compact && "sign-plate-compact")}>
        {rank}
      </span>
      <span aria-hidden className="sign-content" style={{ top: reserveTop }}>
        <span
          className={cx(
            "sign-phrase",
            fit.vertical && "sign-phrase-vertical",
            fit.condensed && "sign-phrase-condensed",
            fit.sideways && "sign-phrase-sideways",
          )}
          style={{ fontSize: fit.size }}
        >
          {fit.lines.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </span>
        <span className="sign-figure" style={{ fontSize: figureSize }}>
          {lines.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </span>
      </span>
      <span aria-hidden className={cx("sign-sub", rect.height < 64 && "sign-sub-tight")}>
        {boardSplit(board)}
      </span>
    </Link>
  );
}

/** Phrase detail over the same 30 days as the board (#276). */
export const termHref = (name: string) => `/terms/${encodeURIComponent(name)}?preset=30d`;

/** Saira Extra Condensed 700 caps, average advance per glyph incl. spaces and digits. */
const FIGURE_EM = 0.5;
/** Smallest share line (px), #334. */
export const FIGURE_MIN = 13;

/** True when the phrase's first line, centred in the board, would run into the rank plate (top-left). */
function collidesWithPlate(fit: PhraseFit, rect: BoardRect, figureSize: number, compact: boolean): boolean {
  const plateRight = compact ? 34 : 44;
  const plateBottom = compact ? 26 : 32;
  const em = fit.condensed ? 0.43 : 0.74;
  const lh = fit.condensed ? 1.05 : 1.2;
  const longest = Math.max(...fit.lines.map((l) => l.length));
  const width = fit.sideways
    ? fit.size * lh
    : fit.vertical
      ? fit.size * 1.25 * fit.lines.length
      : fit.size * em * longest;
  const height = fit.sideways
    ? fit.size * em * longest
    : fit.vertical
      ? fit.size * 1.06 * longest
      : fit.size * lh * fit.lines.length;
  const top = (rect.height - height - figureSize - 6) / 2;
  const left = (rect.width - width) / 2;
  return top < plateBottom && left < plateRight;
}

/** Placeholder board while loading or when no phrase is configured: blank enamel, keyline only. */
export function BlankBoard({ rect, index }: { rect: BoardRect; index: number }) {
  return (
    <div
      aria-hidden
      data-tone="blank"
      className="sign-board sign-board-placeholder absolute"
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          ["--hang-delay"]: `${index * 55}ms`,
          ["--swing-from"]: `${index % 2 === 0 ? -2.4 : 2.4}deg`,
        } as CSSProperties
      }
    >
      <span className="sign-keyline" />
    </div>
  );
}
