import { Board } from "./board";
import { Position } from "./chess";
import { makePiece } from "./fen";
import { SquareSet } from "./squareSet";
import { Piece, Role, Square } from "./types";
import { makeSquare, makeUci, squareRank } from "./util";

export const squareSet = (squares: SquareSet): string => {
  const r = [];
  for (let y = 7; y >= 0; y--) {
    for (let x = 0; x < 8; x++) {
      const square = x + y * 8;
      r.push(squares.has(square) ? '1' : '.');
      r.push(x < 7 ? ' ' : '\n');
    }
  }
  return r.join('');
};


export const piece = (piece: Piece): string => makePiece(piece)


export const board = (board: Board): string => {
  const r = [];
  for (let y = 7; y >= 0; y--) {
    for (let x = 0; x < 8; x++) {
      const square = x + y * 8;
      const d = board.duck === square
      const p = board.get(square);
      const col = p ? piece(p) : d ? 'd' : '.';
      r.push(col);
      r.push(x < 7 ? (col.length < 2 ? ' ' : '') : '\n');
    }
  }
  return r.join('');
};

export const square = (sq: Square): string => makeSquare(sq);


export const perft = (pos: Position, depth: number, log = false): number => {
    if (depth < 1) return 1;

    const promotionRoles: Role[] = ['queen', 'knight', 'rook', 'bishop'];
    let nodes = 0;
    for (const [from, dests] of pos.allDests()) {
        const promotions: Array<Role | undefined> =
            squareRank(from) === (pos.turn === 'white' ? 6 : 1) && pos.board.pawn.has(from) ? promotionRoles : [undefined];
        for (const to of dests) {
            for (const duck of pos.duck_dests(from, to)) {
                for (const promotion of promotions) {
                    const child = pos.clone();
                    const move = { from, to, promotion, duck };
                    child.play(move);
                    const children = perft(child, depth - 1, false);
                    if (log) console.log(makeUci(move), children);
                    nodes += children;
                }
            }
        }
    }
    return nodes;
}