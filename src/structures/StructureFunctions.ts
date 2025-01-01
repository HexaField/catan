import { CubeDirection, cubeNeighbor } from '../hexes/HexagonGridFunctions'
import { CornerDirection, EdgeDirection, StructureDataType } from './StructureSystem'

/**
 * Returns the three hexes adjacent to a corner structure.
 * @param structure
 * @returns The three hexes adjacent to the corner structure,
 *  with the first hex being the hex the structure is on,
 *  the second hex being the hex to the right,
 *  and the third hex being the hex to the left.
 *
 * If the structure is a road, the first hex will be null.
 */
export const getAdjacentHexesToStructure = (structure: StructureDataType) => {
  const { q, r, direction } = structure.coords

  const hex = { q, r, s: -q - r } // this hex

  switch (direction) {
    case 'N':
      return [hex, cubeNeighbor(hex, CubeDirection.Northeast), cubeNeighbor(hex, CubeDirection.Northwest)]
    case 'S':
      return [hex, cubeNeighbor(hex, CubeDirection.Southeast), cubeNeighbor(hex, CubeDirection.Southwest)]
    case 'E':
      return [null, hex, cubeNeighbor(hex, CubeDirection.East)]
    case 'SE':
      return [null, hex, cubeNeighbor(hex, CubeDirection.Southeast)]
    case 'SW':
      return [null, cubeNeighbor(hex, CubeDirection.Southwest), hex]
  }
  return [null, null, null]
}

export const getRandomCornerCoords = () => {
  const q = Math.floor(Math.random() * 5) - 2
  const r = Math.floor(Math.random() * 5) - 2
  const direction = Math.random() > 0.5 ? 'N' : 'S'
  return { q, r, direction } as { q: number; r: number; direction: CornerDirection }
}

export const getRandomEdgeCoords = () => {
  const q = Math.floor(Math.random() * 5) - 2
  const r = Math.floor(Math.random() * 5) - 2
  const direction = Math.random() > 0.5 ? 'E' : Math.random() > 0.5 ? 'SE' : 'SW'
  return { q, r, direction } as { q: number; r: number; direction: EdgeDirection }
}
/**
 * Returns the four edges adjacent to an edge.
 * - in clockwise order
 */
export const getAdjacentEdgesToEdge = (coords: {
  q: number
  r: number
  direction: EdgeDirection
}): { q: number; r: number; direction: EdgeDirection }[] => {
  const { q, r, direction } = coords

  switch (direction) {
    case 'E':
      return [
        { q, r, direction: 'SE' }, // below left
        { q: q + 1, r, direction: 'SW' }, // below right
        { q: q + 1, r: r - 1, direction: 'SE' }, // above right
        { q: q + 1, r: r - 1, direction: 'SW' } // above left
      ]
    case 'SE':
      return [
        { q, r, direction: 'E' }, // above
        { q: q + 1, r, direction: 'SW' }, //  right
        { q: -1, r: r + 1, direction: 'E' }, // below
        { q, r, direction: 'SW' }
      ]
    case 'SW':
      return [
        { q, r, direction: 'SE' }, // right
        { q: q - 1, r: r + 1, direction: 'E' }, // below
        { q: -1, r, direction: 'E' }, // above left
        { q: q - 1, r, direction: 'SE' } // left
      ]
  }
}
/**
 * Returns the two corners adjacent to an edge.
 * - in clockwise order
 */
export const getAdjacentCornersToEdge = (coords: {
  q: number
  r: number
  direction: EdgeDirection
}): { q: number; r: number; direction: CornerDirection }[] => {
  const { q, r, direction } = coords

  switch (direction) {
    case 'E':
      return [
        { q: q + 1, r: r - 1, direction: 'S' }, // above
        { q, r: r + 1, direction: 'N' } // below
      ]
    case 'SE':
      return [
        { q: q + 1, r, direction: 'N' }, // top right
        { q, r, direction: 'S' } // bottom left
      ]
    case 'SW':
      return [
        { q, r, direction: 'S' }, // bottom right
        { q: q - 1, r: r + 1, direction: 'N' } // top left
      ]
  }
}

/**
 * Returns the three edges adjacent to a corner.
 * - in clockwise order
 */
export const getAdjacentEdgesToCorner = (coords: {
  q: number
  r: number
  direction: CornerDirection
}): { q: number; r: number; direction: EdgeDirection }[] => {
  const { q, r, direction } = coords

  switch (direction) {
    case 'N':
      return [
        { q, r: r - 1, direction: 'E' }, // above
        { q: q + 1, r: r - 1, direction: 'SW' }, // right
        { q, r: r - 1, direction: 'SE' } // left
      ]
    case 'S':
      return [
        { q, r, direction: 'SE' }, // right
        { q: q - 1, r: r + 1, direction: 'E' }, // below
        { q, r, direction: 'SW' } // left
      ]
  }
}

/**
 * Returns the three corners adjacent to a corner.
 * - in clockwise order
 */
export const getAdjacentCornersToCorner = (coords: {
  q: number
  r: number
  direction: CornerDirection
}): { q: number; r: number; direction: CornerDirection }[] => {
  const { q, r, direction } = coords

  switch (direction) {
    case 'N':
      return [
        { q: q + 1, r: r - 2, direction: 'S' }, // above
        { q: q + 1, r: r - 1, direction: 'S' }, // right
        { q, r: r - 1, direction: 'S' } // left
      ]
    case 'S':
      return [
        { q, r: r + 1, direction: 'N' }, // right
        { q: q - 1, r: r + 2, direction: 'N' }, // below
        { q: q - 1, r: r + 1, direction: 'N' } // left
      ]
  }
}