/**
 * Piece positions on a board.
 * 
 * Properties are sets of squares, like `board.occupied` for all occupied
 * squares, `board[color]` for all pieces of that color, and `board[role]`
 * for all pieces of that role. When modifying the properties directly, take
 * care to keep them consistent.
 */

import { SquareSet } from "./squareSet";
import { ByColor, ByRole, Color, COLORS, Piece, Role, ROLES, Square } from "./types";

export class Board implements Iterable<[Square, Piece]>, ByRole<SquareSet>, ByColor<SquareSet> {

    duck?: Square

    /**
     * All occupied squares.
     */
    occupied!: SquareSet


    white!: SquareSet;
    black!: SquareSet;

    pawn!: SquareSet;
    knight!: SquareSet;
    bishop!: SquareSet;
    rook!: SquareSet;
    queen!: SquareSet;
    king!: SquareSet;

    get occupied_with_duck() {
        return this.duck ? this.occupied.with(this.duck) : this.occupied
    }

    private constructor() {}

    static default(): Board {
        const board = new Board()
        board.reset()
        return board
    }

    reset(): void {
        this.duck = undefined
        this.occupied = new SquareSet(0xffff, 0xffff_0000);
        this.white = new SquareSet(0xffff, 0);
        this.black = new SquareSet(0, 0xffff_0000);
        this.pawn = new SquareSet(0xff00, 0x00ff_0000);
        this.knight = new SquareSet(0x42, 0x4200_0000);
        this.bishop = new SquareSet(0x24, 0x2400_0000);
        this.rook = new SquareSet(0x81, 0x8100_0000);
        this.queen = new SquareSet(0x8, 0x0800_0000);
        this.king = new SquareSet(0x10, 0x1000_0000);
    }


    clear(): void {
        this.duck = undefined
        this.occupied = SquareSet.empty()
        for (const color of COLORS) this[color] = SquareSet.empty()
        for (const role of ROLES) this[role] = SquareSet.empty()
    }

    static empty(): Board {
        const board = new Board()
        board.clear()
        return board
    }


    clone(): Board {
        const board = new Board()
        board.duck = this.duck
        board.occupied = this.occupied
        for (const color of COLORS) this[color] = board[color] = this[color]
        for (const role of ROLES) this[role] = board[role] = this[role]
        return board
    }

    getColor(square: Square): Color | undefined {
        if (this.white.has(square)) return 'white'
        if (this.black.has(square)) return 'black'
        return
    }

    getRole(square: Square): Role | undefined {
        for (const role of ROLES) {
            if (this[role].has(square)) return role
        }
        return
    }

    get_duck(): Square | undefined {
        return this.duck
    }

    set_duck(square: Square) {
        this.duck = square
    }

    get(square: Square): Piece | undefined {
        const color = this.getColor(square)
        if (!color) return
        const role = this.getRole(square)!
        return { color, role }
    }


    take(square: Square): Piece | undefined {
        const piece = this.get(square)
        if (piece) {
            this.occupied = this.occupied.without(square)
            this[piece.color] = this[piece.color].without(square)
            this[piece.role] = this[piece.role].without(square)
        }
        return piece
    }

    set(square: Square, piece: Piece): Piece | undefined {
        const old = this.take(square)
        this.occupied = this.occupied.with(square)
        this[piece.color] = this[piece.color].with(square)
        this[piece.role] = this[piece.role].with(square)
        return old
    }


    has(square: Square): boolean {
        return this.occupied.has(square)
    }


    *[Symbol.iterator](): Iterator<[Square, Piece]> {
        for (const square of this.occupied) {
            yield [square, this.get(square)!]
        }
    }


    pieces(color: Color, role: Role): SquareSet {
        return this[color].intersect(this[role])
    }


    rooksAndQueens(): SquareSet {
        return this.rook.union(this.queen)
    }


    bishopsAndQueens(): SquareSet {
        return this.bishop.union(this.queen)
    }


    /**
     * Finds the unique king of the given `color`, if any.
     */
    kingOf(color: Color): Square | undefined {
        return this.pieces(color, 'king').singleSquare()
    }
}

export const boardEquals = (left: Board, right: Board): boolean =>
    left.duck === right.duck &&
    left.white.equals(right.white) && ROLES.every(role => left[role].equals(right[role]))