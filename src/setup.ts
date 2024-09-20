import { Board, boardEquals } from "./board";
import { SquareSet } from "./squareSet";
import { Color, Square } from "./types";

/**
 * A not necessarily legal duck chess position
 */
export interface Setup {
    board: Board;
    turn: Color;
    castlingRights: SquareSet;
    epSquare: Square | undefined;
    halfmoves: number;
    fullmoves: number;
}


export const defaultSetup = (): Setup => ({
    board: Board.default(),
    turn: 'white',
    castlingRights: SquareSet.corners(),
    epSquare: undefined,
    halfmoves: 0,
    fullmoves: 1
})


export const setupClone = (setup: Setup): Setup => ({
    board: setup.board.clone(),
    turn: setup.turn,
    castlingRights: setup.castlingRights,
    epSquare: setup.epSquare,
    halfmoves: setup.halfmoves,
    fullmoves: setup.fullmoves
})


export const setupEquals = (left: Setup, right: Setup): boolean =>
    boardEquals(left.board, right.board)
    && left.turn === right.turn
    && left.castlingRights.equals(right.castlingRights)
    && left.epSquare === right.epSquare
    && left.halfmoves === right.halfmoves
    && left.fullmoves === right.fullmoves