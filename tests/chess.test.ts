import { expect, it } from 'vitest'
import { DuckChess, SquareSet, debug, makeSquare, parseSquare } from '../src'
import { makeFen } from '../src/fen'
import { square } from '../src/debug'
import { chessgroundDests } from '../src/compat'
const { perft } = debug

const e2 = parseSquare('e2')
const e4 = parseSquare('e4')
const e3 = parseSquare('e3')
const e7 = parseSquare('e7')
const e6 = parseSquare('e6')
const e5 = parseSquare('e5')

const squareSet = (set: SquareSet): string[] => Array.from(set, square)

it('works', () => {
    const pos = DuckChess.default()


    pos.pplay({ from: e2, to: e4, duck: e3 })

    expect(makeFen(pos.toSetup())).toBe('rnbqkbnr/pppppppp/8/8/4P3/4d3/PPPP1PPP/RNBQKBNR b KQkq - 0 1')

    expect(pos.dests(e3).isEmpty()).toBe(true)
    expect(squareSet(pos.duck_dests(e7, e6)).includes('e3')).toBe(false)
    expect(squareSet(pos.duck_dests(e7, e6)).includes('e2')).toBe(true)
    expect(squareSet(pos.duck_dests(e7, e6)).includes('e4')).toBe(false)

    pos.pplay({ from: e7, to: e6, duck: e5 })

    expect(makeFen(pos.toSetup())).toBe('rnbqkbnr/pppp1ppp/4p3/4d3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')
})

it.only('perft tests', () => {
    const pos = DuckChess.default()

    expect(perft(pos, 0, false)).toBe(1)
    expect(perft(pos, 1, false)).toBe(640)
    expect(perft(pos, 2, false)).toBe(379440)
    //expect(perft(pos, 3, false)).toBe(249921262)

})