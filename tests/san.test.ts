import { expect, it } from "vitest"
import { DuckChess, makeSan, parseSquare, parseUci } from "../src"

const e2 = parseSquare('e2')
const e4 = parseSquare('e4')
const e3 = parseSquare('e3')

it('works', () => {
    const pos = DuckChess.default()


    let move = parseUci('g3@f2f4')!

    expect(makeSan(pos, move)).toBe('g3@f4')
})

