export const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export type FileName = (typeof FILE_NAMES)[number]
export type RankName = (typeof RANK_NAMES)[number]


export type Square = number

export type SquareName = `${FileName}${RankName}`


export type BySquare<T> = T[]

export const COLORS = ['white', 'black'] as const;

export type Color = (typeof COLORS)[number]


export type ByColor<T> = {
    [color in Color]: T
}


export const ROLES = ['pawn', 'knight', 'bishop', 'rook' , 'queen', 'king'] as const


export type Role = (typeof ROLES)[number]


export type ByRole<T> = {
    [role in Role]: T
}


export const CASTLING_SIDES = ['a', 'h'] as const

export type CastlingSide = (typeof CASTLING_SIDES)[number]


export type ByCastlingSide<T> = {
    [side in CastlingSide]: T
}


export interface Piece {
    role: Role;
    color: Color;
}


export interface Move {
    from: Square;
    to: Square;
    promotion?: Role;
    duck: Square
}


export interface Outcome {
    winner: Color | undefined
}