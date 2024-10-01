import { Result } from "@badrap/result";
import { between, bishopAttacks, kingAttacks, knightAttacks, pawnAttacks, queenAttacks, rookAttacks } from "./attacks";
import { Board, boardEquals } from "./board";
import { Setup } from "./setup";
import { SquareSet } from "./squareSet";
import { ByCastlingSide, ByColor, CASTLING_SIDES, CastlingSide, Color, COLORS, Move, Outcome, Piece, Square } from "./types";
import { defined, kingCastlesTo, opposite, rookCastlesTo, squareRank } from "./util";

export enum IllegalSetup {
    Empty = 'ERR_EMPTY',
    PawnsOnBackrank = 'ERR_PAWNS_ON_BACKRANK',
    Kings = 'ERR_KINGS',
}


export class PositionError extends Error {}

export class Castles {
  castlingRights!: SquareSet;
  rook!: ByColor<ByCastlingSide<Square | undefined>>;
  path!: ByColor<ByCastlingSide<SquareSet>>;

  private constructor() {}

  static default(): Castles {
    const castles = new Castles();
    castles.castlingRights = SquareSet.corners();
    castles.rook = {
      white: { a: 0, h: 7 },
      black: { a: 56, h: 63 },
    };
    castles.path = {
      white: { a: new SquareSet(0xe, 0), h: new SquareSet(0x60, 0) },
      black: { a: new SquareSet(0, 0x0e000000), h: new SquareSet(0, 0x60000000) },
    };
    return castles;
  }

  static empty(): Castles {
    const castles = new Castles();
    castles.castlingRights = SquareSet.empty();
    castles.rook = {
      white: { a: undefined, h: undefined },
      black: { a: undefined, h: undefined },
    };
    castles.path = {
      white: { a: SquareSet.empty(), h: SquareSet.empty() },
      black: { a: SquareSet.empty(), h: SquareSet.empty() },
    };
    return castles;
  }

  clone(): Castles {
    const castles = new Castles();
    castles.castlingRights = this.castlingRights;
    castles.rook = {
      white: { a: this.rook.white.a, h: this.rook.white.h },
      black: { a: this.rook.black.a, h: this.rook.black.h },
    };
    castles.path = {
      white: { a: this.path.white.a, h: this.path.white.h },
      black: { a: this.path.black.a, h: this.path.black.h },
    };
    return castles;
  }

  private add(color: Color, side: CastlingSide, king: Square, rook: Square): void {
    const kingTo = kingCastlesTo(color, side);
    const rookTo = rookCastlesTo(color, side);
    this.castlingRights = this.castlingRights.with(rook);
    this.rook[color][side] = rook;
    this.path[color][side] = between(rook, rookTo)
      .with(rookTo)
      .union(between(king, kingTo).with(kingTo))
      .without(king)
      .without(rook);
  }

  static fromSetup(setup: Setup): Castles {
    const castles = Castles.empty();
    const rooks = setup.castlingRights.intersect(setup.board.rook);
    for (const color of COLORS) {
      const backrank = SquareSet.backrank(color);
      const king = setup.board.kingOf(color);
      if (!defined(king) || !backrank.has(king)) continue;
      const side = rooks.intersect(setup.board[color]).intersect(backrank);
      const aSide = side.first();
      if (defined(aSide) && aSide < king) castles.add(color, 'a', king, aSide);
      const hSide = side.last();
      if (defined(hSide) && king < hSide) castles.add(color, 'h', king, hSide);
    }
    return castles;
  }

  discardRook(square: Square): void {
    if (this.castlingRights.has(square)) {
      this.castlingRights = this.castlingRights.without(square);
      for (const color of COLORS) {
        for (const side of CASTLING_SIDES) {
          if (this.rook[color][side] === square) this.rook[color][side] = undefined;
        }
      }
    }
  }

  discardColor(color: Color): void {
    this.castlingRights = this.castlingRights.diff(SquareSet.backrank(color));
    this.rook[color].a = undefined;
    this.rook[color].h = undefined;
  }
}

/*
export interface Context {
    king: Square | undefined;
    blockers: SquareSet;
    checkers: SquareSet;
}
    */


export abstract class Position {


    board!: Board;
    turn!: Color;
    castles!: Castles;
    epSquare?: Square;
    halfmoves!: number;
    fullmoves!: number;

    rule50_ply = 0
    repetitions = 0
    cycle_length = 0

    protected constructor() {}

    getRule50Ply() { return this.rule50_ply }

    setRepetitions(repetitions: number, cycle_length: number) {
      this.repetitions = repetitions
      this.cycle_length = cycle_length
    }

    getRepetitions() {
      return this.repetitions
    }

    getGamePly() {
      return this.halfmoves
    }

    reset() {
        this.board = Board.default()
        this.turn = 'white'
        this.castles = Castles.default()
        this.epSquare = undefined
        this.halfmoves = 0
        this.fullmoves = 1
    }


    protected setupUnchecked(setup: Setup) {
        this.board = setup.board.clone()
        this.turn = setup.turn
        this.castles = Castles.fromSetup(setup)
        this.epSquare = validEpSquare(this, setup.epSquare)
        this.halfmoves = setup.halfmoves
        this.fullmoves = setup.fullmoves
    }


    protected playCaptureAt(square: Square, captured: Piece): void {
        this.halfmoves = 0
        if (captured.role === 'rook') this.castles.discardRook(square)
    }


    clone(): Position {
        const pos = new (this as any).constructor()
        pos.board = this.board.clone()
        pos.turn = this.turn
        pos.castles = this.castles
        pos.epSquare = this.epSquare
        pos.halfmoves = this.halfmoves
        pos.fullmoves = this.fullmoves
        return pos
    }

    protected validate(): Result<undefined, PositionError> {

        if (this.board.occupied.isEmpty()) return Result.err(new PositionError(IllegalSetup.Empty))
        if (this.board.king.size() !== 2 || this.board.king.size() !== 1) return Result.err(new PositionError(IllegalSetup.Kings))

        if (SquareSet.backranks().intersects(this.board.pawn)) {
            return Result.err(new PositionError(IllegalSetup.PawnsOnBackrank))
        }


        return Result.ok(undefined)
    }


    duck_dests(from: Square, to: Square): SquareSet {
        let res = this.board.occupied.without(from).with(to)
        if (this.board.duck) {
            res = res.with(this.board.duck)
        }
        return res.complement()
    }

    dests(square: Square): SquareSet {

        const piece = this.board.get(square)
        if (!piece || piece.color !== this.turn) return SquareSet.empty()


        let pseudo, legal
        if (piece.role === 'pawn') {
            pseudo = pawnAttacks(this.turn, square).intersect(this.board[opposite(this.turn)])
            const delta = this.turn === 'white' ? 8 : -8
            const step = square + delta
            if (0 <= step && step < 64 && !this.board.occupied_with_duck.has(step)) {
                pseudo = pseudo.with(step)
                let canDoubleStep = this.turn === 'white' ? square < 16 : square >= 64 - 16
                const doubleStep = step + delta
                if (canDoubleStep && !this.board.occupied_with_duck.has(doubleStep)) {
                    pseudo = pseudo.with(doubleStep)
                }
            }
            if (defined(this.epSquare) && canCaptureEp(this, square)) {
                legal = SquareSet.fromSquare(this.epSquare)
            }
        } else if (piece.role === 'bishop') pseudo = bishopAttacks(square, this.board.occupied_with_duck)
            else if (piece.role === 'knight') pseudo = knightAttacks(square)
            else if (piece.role === 'rook') pseudo = rookAttacks(square, this.board.occupied_with_duck)
            else if (piece.role === 'queen') pseudo = queenAttacks(square, this.board.occupied_with_duck)
        else pseudo = kingAttacks(square)


        pseudo = pseudo.diff(this.board[this.turn])


        if (legal) pseudo = pseudo.union(legal)

        return pseudo
    }


    toSetup(): Setup {
        return {
            board: this.board.clone(),
            turn: this.turn,
            castlingRights: this.castles.castlingRights,
            epSquare: legalEpSquare(this),
            halfmoves: Math.min(this.halfmoves, 150),
            fullmoves: Math.min(Math.max(this.fullmoves, 1), 9999)
        }
    }


    hasDests(): boolean {
        for (const square of this.board[this.turn]) {
            if (this.dests(square).nonEmpty()) return true
        }
        return false
    }


    isLegal(move: Move): boolean {
        if (move.promotion === 'pawn' || move.promotion === 'king') return false
        if (!!move.promotion !== (this.board.pawn.has(move.from) && SquareSet.backranks().has(move.to))) return false
        const dests = this.dests(move.from)
        return dests.has(move.to) || dests.has(normalizeMove(this, move).to)
    }

    isEnd(): boolean {
        return !this.hasDests()
    }

    isKingCaptured(): boolean {
        return this.board.king.size() === 1
    }

    isStalemate(): boolean {
        return !this.isKingCaptured() && !this.hasDests()
    }


    outcome(): Outcome | undefined {
        if (this.isKingCaptured()) return { winner: opposite(this.turn) }
        else if (this.isStalemate()) return { winner: this.turn }
    }


    allDests(): Map<Square, SquareSet> {
        const d = new Map()
        for (const square of this.board[this.turn]) {
            d.set(square, this.dests(square))
        }
        return d
    }


    play(move: Move): boolean {
      let reset_50_moves = false
        const turn = this.turn
        const epSquare = this.epSquare
        const castling = castlingSide(this, move)


        this.epSquare = undefined
        this.halfmoves += 1
        if (turn == 'black') this.fullmoves += 1
        this.turn = opposite(turn)


        const piece = this.board.take(move.from)
        if (!piece) return false

        this.board.duck = move.duck

        let epCapture: Piece | undefined
        if (piece.role === 'pawn') {
          reset_50_moves = true
            this.halfmoves = 0
            if (move.to === epSquare) {
                epCapture = this.board.take(move.to + (turn === 'white' ? -8 : 8))
            }
            const delta = move.from - move.to
            if (Math.abs(delta) === 16 && 8 <= move.from && move.from <= 55) {
                this.epSquare = (move.from + move.to) >> 1
            }
            if (move.promotion) {
                piece.role = move.promotion
            }
        } else if (piece.role === 'rook') {
            this.castles.discardRook(move.from)
        } else if (piece.role === 'king') {
            if (castling) {
                const rookFrom = this.castles.rook[turn][castling]
                if (defined(rookFrom)) {
                    const rook = this.board.take(rookFrom)
                    this.board.set(kingCastlesTo(turn, castling), piece)
                    if (rook) this.board.set(rookCastlesTo(turn, castling), rook)
                }
            }
            this.castles.discardColor(turn)
        }


        if (!castling) {
            const capture = this.board.set(move.to, piece) || epCapture
            if (capture) {
              this.playCaptureAt(move.to, capture)
              reset_50_moves = true
            }
        }

      return reset_50_moves
    }

}


export class DuckChess extends Position {

    static make = (board: Board, rule50_ply: number, cycle_length: number) => {

      let res = DuckChess.default()
      res.board = board
      res.rule50_ply = rule50_ply
      res.cycle_length = cycle_length

      return res
    }


    static make_from_move = (parent: DuckChess, m: Move) => {
      let res = parent.clone()
      let is_zeroing = res.play(m)
      if (is_zeroing) {
        res.rule50_ply = 0
      }
      return res
    }




    private constructor() { super() }


    static default(): DuckChess {
        const pos = new this()
        pos.reset()
        return pos
    }


    static fromSetup(setup: Setup): Result<DuckChess, PositionError> {
        const pos = new this()
        pos.setupUnchecked(setup)
        return pos.validate().map(_ => pos)
    }


    clone(): DuckChess {
        return super.clone() as DuckChess
    }
}


const validEpSquare = (pos: Position, square: Square | undefined): Square | undefined => {
  if (!defined(square)) return;
  const epRank = pos.turn === 'white' ? 5 : 2;
  const forward = pos.turn === 'white' ? 8 : -8;
  if (squareRank(square) !== epRank) return;
  if (pos.board.occupied.has(square + forward)) return;
  const pawn = square - forward;
  if (!pos.board.pawn.has(pawn) || !pos.board[opposite(pos.turn)].has(pawn)) return;
  return square;
};


const canCaptureEp = (pos: Position, pawnFrom: Square): boolean => {
  if (!defined(pos.epSquare)) return false;
  if (!pawnAttacks(pos.turn, pawnFrom).has(pos.epSquare)) return false;
  return true;
};


const legalEpSquare = (pos: Position): Square | undefined => {
  if (!defined(pos.epSquare)) return;
  const ourPawns = pos.board.pieces(pos.turn, 'pawn');
  const candidates = ourPawns.intersect(pawnAttacks(opposite(pos.turn), pos.epSquare));
  for (const candidate of candidates) {
    if (pos.dests(candidate).has(pos.epSquare)) return pos.epSquare;
  }
  return;
};

export const castlingSide = (pos: Position, move: Move): CastlingSide | undefined => {
  const delta = move.to - move.from;
  if (Math.abs(delta) !== 2 && !pos.board[pos.turn].has(move.to)) return;
  if (!pos.board.king.has(move.from)) return;
  return delta > 0 ? 'h' : 'a';
};

export const normalizeMove = (pos: Position, move: Move): Move => {
    const side = castlingSide(pos, move)
    if (!side) return move
    const rookFrom = pos.castles.rook[pos.turn][side]
    return {
        from: move.from,
        to: defined(rookFrom)? rookFrom: move.to,
        duck: move.duck
    }
}

enum GameResult {
  WHITE_WON,
  BLACK_WON,
  DRAW,
  UNDECIDED
}

export class PositionHistory {
  positions: Position[] = []

  last() { return this.positions[this.positions.length - 1] }

  computeGameResult(): GameResult {
    let pos = this.last()

    if (!pos.hasDests()) {
      if (pos.isKingCaptured()) {
        if (pos.turn === 'white') {
          return GameResult.BLACK_WON
        } else {
          return GameResult.WHITE_WON
        }
      } else {
        if (pos.turn === 'white') {
          return GameResult.WHITE_WON
        } else {
          return GameResult.BLACK_WON
        }
      }
    }


    if (pos.getRule50Ply() >= 100) return GameResult.DRAW
    if (pos.getRepetitions() >= 2) return GameResult.DRAW

    return GameResult.UNDECIDED
  }

  append(m: Move) {
    this.positions.push(DuckChess.make_from_move(this.last(), m))
    let [cycle_length, repetitions] = this.computeLastMoveRepetitions()
    this.positions[this.positions.length - 1].setRepetitions(repetitions, cycle_length)
  }

  reset(board: Board, rule50_ply: number, game_ply: number) {
    this.positions = []
    this.positions.push(DuckChess.make(board, rule50_ply, game_ply))
  }

  computeLastMoveRepetitions() {
    let cycle_length = 0
    let last = this.positions[this.positions.length - 1]

    if (last.getRule50Ply() < 4) return [cycle_length, 0]
    for (let idx = this.positions.length - 3; idx >= 0; idx -= 2) {
      let pos = this.positions[idx]
      if (boardEquals(pos.board, last.board)) {
        cycle_length = this.positions.length - 1 - idx
        return [cycle_length, 1 + pos.getRepetitions()]
      }
      if (pos.getRule50Ply() < 2) return [cycle_length, 0]
    }
    return [cycle_length, 0]
  }

}