import type { PieceOf, PieceType } from "../spec.ts";
import type { BoardPalette } from "../../shared/theme.ts";

export interface PieceProps<T extends PieceType> {
  piece: PieceOf<T>;
  w: number;
  h: number;
  t: number;
  span: number;
  palette: BoardPalette;
}
