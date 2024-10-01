import { Position } from "./chess"
import { SquareName } from "./types"
import { makeSquare, parseSquare, squareFile } from "./util"

export interface ChessgroundDestsOpts {
    chess960?: boolean
}


/**
 * Computes the legal move destinations in the format used by chessground.
 * 
 * Includes both possible representations of castling moves (unless 
 * `chess960` mode is enabled), so that the `rookCastles` option will work
 * correctly.
 */
export const chessgroundDests = (pos: Position, opts?: ChessgroundDestsOpts): Map<SquareName, SquareName[]> => {

    const res = new Map()

    for (const [from, squares] of pos.allDests()) {
        if (squares.nonEmpty()) {
            const d = Array.from(squares, makeSquare)
            if (!opts?.chess960 && pos.board.getRole(from) === 'king' && squareFile(from) === 4) {
                // Chessground needs both types of castling dests and filters based on
                // a rookCastles setting.
                if (squares.has(0)) d.push('c1')
                else if (squares.has(56)) d.push('c8')
                if (squares.has(7)) d.push('g1')
                else if (squares.has(63)) d.push('g8')
            }
            res.set(makeSquare(from), d)
        }
    }
    return res
}


export const duckDests = (pos: Position) => {

    let res = []
    let dests = chessgroundDests(pos)

    for (let [from, tos] of dests) {
        for (let to of tos) {
            for (let duck of pos.duck_dests(parseSquare(from), parseSquare(to))) {
                res.push(`${makeSquare(duck)}@${from}${to}`)
            }
        }
    }

    return res
}