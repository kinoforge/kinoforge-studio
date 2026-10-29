import { SignView } from "../road/sign.tsx";
import type { Piece } from "../spec.ts";
import type { BoardPalette } from "../theme.ts";
import { LineView, NumberLineView, PieView } from "./charts.tsx";
import { BarsView, CompareView, CounterView, ProgressView, TerminalView } from "./data.tsx";
import { IconsView, ListView, StepsView, TimelineView } from "./lists.tsx";
import { BrowserView, ChatView } from "./screens.tsx";
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
    case "sign":
      return <SignView piece={piece} {...shared} />;
    case "line":
      return <LineView piece={piece} {...shared} />;
    case "pie":
      return <PieView piece={piece} {...shared} />;
    case "numberline":
      return <NumberLineView piece={piece} {...shared} />;
    case "chat":
      return <ChatView piece={piece} {...shared} />;
    case "browser":
      return <BrowserView piece={piece} {...shared} />;
    case "stamp":
      return null;
  }
}
