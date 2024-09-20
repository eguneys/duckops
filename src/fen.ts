import { Result } from '@badrap/result';
import { Board } from './board.js';
import { SquareSet } from './squareSet.js';
import { Color, COLORS, FILE_NAMES, Piece, Square } from './types.js';
import { charToRole, defined, makeSquare, parseSquare, roleToChar, squareFile, squareFromCoords } from './util.js';
import { Setup } from './setup.js';

export const INITIAL_BOARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const INITIAL_EPD = INITIAL_BOARD_FEN + ' w KQkq -';
export const INITIAL_FEN = INITIAL_EPD + ' 0 1';
export const EMPTY_BOARD_FEN = '8/8/8/8/8/8/8/8';
export const EMPTY_EPD = EMPTY_BOARD_FEN + ' w - -';
export const EMPTY_FEN = EMPTY_EPD + ' 0 1';

export enum InvalidFen {
  Fen = 'ERR_FEN',
  Board = 'ERR_BOARD',
  Pockets = 'ERR_POCKETS',
  Turn = 'ERR_TURN',
  Castling = 'ERR_CASTLING',
  EpSquare = 'ERR_EP_SQUARE',
  RemainingChecks = 'ERR_REMAINING_CHECKS',
  Halfmoves = 'ERR_HALFMOVES',
  Fullmoves = 'ERR_FULLMOVES',
}

export class FenError extends Error {}

const nthIndexOf = (haystack: string, needle: string, n: number): number => {
  let index = haystack.indexOf(needle);
  while (n-- > 0) {
    if (index === -1) break;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return index;
};

const parseSmallUint = (str: string): number | undefined => (/^\d{1,4}$/.test(str) ? parseInt(str, 10) : undefined);

const charToPiece = (ch: string): Piece | undefined => {
  const role = charToRole(ch);
  return role && { role, color: ch.toLowerCase() === ch ? 'black' : 'white' };
};

export const parseBoardFen = (boardPart: string): Result<Board, FenError> => {
  const board = Board.empty();
  let rank = 7;
  let file = 0;
  for (let i = 0; i < boardPart.length; i++) {
    const c = boardPart[i];
    if (c === '/' && file === 8) {
      file = 0;
      rank--;
    } else {
      const step = parseInt(c, 10);
      if (step > 0) file += step;
      else {
        if (file >= 8 || rank < 0) return Result.err(new FenError(InvalidFen.Board));
        const square = file + rank * 8;
        if (c === 'd') {
            board.duck = square
        } else {
            const piece = charToPiece(c);
            if (!piece) return Result.err(new FenError(InvalidFen.Board));
            board.set(square, piece);
        }
        file++;
      }
    }
  }
  if (rank !== 0 || file !== 8) return Result.err(new FenError(InvalidFen.Board));
  return Result.ok(board);
};

export const parseCastlingFen = (board: Board, castlingPart: string): Result<SquareSet, FenError> => {
  let castlingRights = SquareSet.empty();
  if (castlingPart === '-') return Result.ok(castlingRights);

  for (const c of castlingPart) {
    const lower = c.toLowerCase();
    const color = c === lower ? 'black' : 'white';
    const rank = color === 'white' ? 0 : 7;
    if ('a' <= lower && lower <= 'h') {
      castlingRights = castlingRights.with(squareFromCoords(lower.charCodeAt(0) - 'a'.charCodeAt(0), rank)!);
    } else if (lower === 'k' || lower === 'q') {
      const rooksAndKings = board[color].intersect(SquareSet.backrank(color)).intersect(board.rook.union(board.king));
      const candidate = lower === 'k' ? rooksAndKings.last() : rooksAndKings.first();
      castlingRights = castlingRights.with(
        defined(candidate) && board.rook.has(candidate) ? candidate : squareFromCoords(lower === 'k' ? 7 : 0, rank)!,
      );
    } else return Result.err(new FenError(InvalidFen.Castling));
  }

  if (COLORS.some(color => SquareSet.backrank(color).intersect(castlingRights).size() > 2)) {
    return Result.err(new FenError(InvalidFen.Castling));
  }

  return Result.ok(castlingRights);
};

export const parseFen = (fen: string): Result<Setup, FenError> => {
    const parts = fen.split(/[\s_]+/);
    const boardPart = parts.shift()!;

    // Board
    let board: Result<Board, FenError>;
    if (boardPart.endsWith(']')) {
        const pocketStart = boardPart.indexOf('[');
        if (pocketStart === -1) return Result.err(new FenError(InvalidFen.Fen));
        board = parseBoardFen(boardPart.slice(0, pocketStart));
    } else {
        const pocketStart = nthIndexOf(boardPart, '/', 7);
        if (pocketStart === -1) board = parseBoardFen(boardPart);
        else {
            board = parseBoardFen(boardPart.slice(0, pocketStart));
        }
    }

    // Turn
    let turn: Color;
    const turnPart = parts.shift();
    if (!defined(turnPart) || turnPart === 'w') turn = 'white';
    else if (turnPart === 'b') turn = 'black';
    else return Result.err(new FenError(InvalidFen.Turn));

    return board.chain(board => {
        // Castling
        const castlingPart = parts.shift();
        const castlingRights = defined(castlingPart) ? parseCastlingFen(board, castlingPart) : Result.ok(SquareSet.empty());

        // En passant square
        const epPart = parts.shift();
        let epSquare: Square | undefined;
        if (defined(epPart) && epPart !== '-') {
            epSquare = parseSquare(epPart);
            if (!defined(epSquare)) return Result.err(new FenError(InvalidFen.EpSquare));
        }

        // Halfmoves or remaining checks
        let halfmovePart = parts.shift();
        if (defined(halfmovePart) && halfmovePart.includes('+')) {
            halfmovePart = parts.shift();
        }
        const halfmoves = defined(halfmovePart) ? parseSmallUint(halfmovePart) : 0;
        if (!defined(halfmoves)) return Result.err(new FenError(InvalidFen.Halfmoves));

        const fullmovesPart = parts.shift();
        const fullmoves = defined(fullmovesPart) ? parseSmallUint(fullmovesPart) : 1;
        if (!defined(fullmoves)) return Result.err(new FenError(InvalidFen.Fullmoves));

        if (parts.length > 0) return Result.err(new FenError(InvalidFen.Fen));

        return castlingRights.map(castlingRights => ({
            board,
            turn,
            castlingRights,
            epSquare,
            halfmoves,
            fullmoves: Math.max(1, fullmoves),
        }))
    });
};

export interface FenOpts {
  epd?: boolean;
}

export const parsePiece = (str: string): Piece | undefined => {
  if (!str) return;
  const piece = charToPiece(str[0]);
  if (!piece) return;
  else if (str.length > 1) return;
  return piece;
};

export const makePiece = (piece: Piece): string => {
  let r = roleToChar(piece.role);
  if (piece.color === 'white') r = r.toUpperCase();
  return r;
};

export const makeBoardFen = (board: Board): string => {
  let fen = '';
  let empty = 0;
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = file + rank * 8;
      const piece = board.get(square);
      const duck = board.duck === square

      if (!piece && !duck) empty++;
      else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += duck ? 'd' : makePiece(piece!);
      }

      if (file === 7) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        if (rank !== 0) fen += '/';
      }
    }
  }
  return fen;
};


export const makeCastlingFen = (board: Board, castlingRights: SquareSet): string => {
  let fen = '';
  for (const color of COLORS) {
    const backrank = SquareSet.backrank(color);
    let king = board.kingOf(color);
    if (defined(king) && !backrank.has(king)) king = undefined;
    const candidates = board.pieces(color, 'rook').intersect(backrank);
    for (const rook of castlingRights.intersect(backrank).reversed()) {
      if (rook === candidates.first() && defined(king) && rook < king) {
        fen += color === 'white' ? 'Q' : 'q';
      } else if (rook === candidates.last() && defined(king) && king < rook) {
        fen += color === 'white' ? 'K' : 'k';
      } else {
        const file = FILE_NAMES[squareFile(rook)];
        fen += color === 'white' ? file.toUpperCase() : file;
      }
    }
  }
  return fen || '-';
};

export const makeFen = (setup: Setup, opts?: FenOpts): string =>
  [
    makeBoardFen(setup.board),
    setup.turn[0],
    makeCastlingFen(setup.board, setup.castlingRights),
    defined(setup.epSquare) ? makeSquare(setup.epSquare) : '-',
    ...(opts?.epd ? [] : [Math.max(0, Math.min(setup.halfmoves, 9999)), Math.max(1, Math.min(setup.fullmoves, 9999))]),
  ].join(' ');