import type { CSSProperties } from "react";
import { cx } from "@/utils/cx";
import { landingCopy as copy } from "./copy";
import { type LandingBoard, boardLabel, boardSplit, boardTone, viRate } from "./landing-data";
import { type BoardRect, type PhraseFit, phraseFit } from "./sign-wall-layout";

type Props = { board: LandingBoard; rect: BoardRect; rank: number; index: number };

/**
 * One enamel signboard (#271): the phrase in straight quotes, its dominant share painted below, a house-number rank
 * plate, and a sub-sign with the full split that slides up on hover/focus. Not a link (no drill-down on the landing);
 * focusable `role="img"` whose name carries the full text (BR-017: colour always with words).
 */
export function SignBoard({ board, rect, rank, index }: Props) {
  const compact = rect.width < 96 || rect.height < 72;
  // BR-017: the share line always shows, on one line ("62,0% TIÊU CỰC" never breaks), sized to the board's width.
  const figure = board.empty ? copy.noMentions : `${viRate(board.dominantShare)} ${copy.sentiment[board.dominant]}`;
  const figureSize = Math.round(
    Math.max(10, Math.min(30, rect.height * 0.12, (rect.width - 28) / (figure.length * FIGURE_EM))),
  );
  const textBox = rect.height - figureSize - 10;
  // The rank plate stays clear of the phrase: reserve its band only when the first line would reach it.
  let reserveTop = 0;
  let fit = phraseFit(board.name, rect.width, textBox);
  if (collidesWithPlate(fit, rect, figureSize, compact)) {
    reserveTop = compact ? 20 : 28;
    fit = phraseFit(board.name, rect.width, textBox, reserveTop);
  }
  const swing = index % 2 === 0 ? -2.4 : 2.4;
  return (
    <div
      role="img"
      tabIndex={0}
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
          {figure}
        </span>
      </span>
      <span aria-hidden className={cx("sign-sub", rect.height < 64 && "sign-sub-tight")}>
        {boardSplit(board)}
      </span>
    </div>
  );
}

/** Saira Extra Condensed 700 caps, average advance per glyph incl. spaces and digits. */
const FIGURE_EM = 0.5;

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
