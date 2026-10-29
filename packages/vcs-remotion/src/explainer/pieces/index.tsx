import type { Piece } from "../spec.ts";
import type { BoardPalette } from "../theme.ts";
import { BarsView, CompareView, CounterView, ProgressView, TerminalView } from "./data.tsx";
import { IconsView, ListView, StepsView, TimelineView } from "./lists.tsx";
import { FormulaView, NoteView, QuoteView, StampView, TitleView } from "./words.tsx";

export { StampView };

export function PieceView({
  piece,
  w,
  h,
  t,
  span,
  palette,
}: {
  piece: Piece;
  w: number;
  h: number;
  t: number;
  span: number;
  palette: BoardPalette;
}) {
  const shared = { w, h, t, span, palette };
  switch (piece.type) {
    case "title":
      return <TitleView piece={piece} {...shared} />;
    case "note":
      return <NoteView piece={piece} {...shared} />;
    case "list":
      return <ListView piece={piece} {...shared} />;
    case "steps":
      return <StepsView piece={piece} {...shared} />;
    case "counter":
      return <CounterView piece={piece} {...shared} />;
    case "bars":
      return <BarsView piece={piece} {...shared} />;
    case "compare":
      return <CompareView piece={piece} {...shared} />;
    case "terminal":
      return <TerminalView piece={piece} {...shared} />;
    case "quote":
      return <QuoteView piece={piece} {...shared} />;
    case "icons":
      return <IconsView piece={piece} {...shared} />;
    case "progress":
      return <ProgressView piece={piece} {...shared} />;
    case "timeline":
      return <TimelineView piece={piece} {...shared} />;
    case "formula":
      return <FormulaView piece={piece} {...shared} />;
    case "stamp":
      return null;
  }
}
