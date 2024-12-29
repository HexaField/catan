// https://www.redblobgames.com/grids/hexagons/

export type AxialCoords = { q: number; r: number }
export type CubeCoords = { q: number; r: number; s: number }

export const cubeScale = (hex: CubeCoords, factor: number) => {
  return { q: hex.q * factor, r: hex.r * factor, s: hex.s * factor }
}

export const cubeDirectionVectors = [
  { q: +1, r: +0, s: -1 }, // west
  { q: +1, r: -1, s: +0 }, // northwest
  { q: +0, r: -1, s: +1 }, // northeast
  { q: -1, r: +0, s: +1 }, // east
  { q: -1, r: +1, s: +0 }, // southeast
  { q: +0, r: +1, s: -1 } // southwest
]

export const CubeDirection = {
  West: 0,
  Northwest: 1,
  Northeast: 2,
  East: 3,
  Southeast: 4,
  Southwest: 5
} as const

export const cubeDirection = (direction: number) => {
  return cubeDirectionVectors[direction]
}

export const cubeAdd = (hex: CubeCoords, vec: CubeCoords) => {
  return { q: hex.q + vec.q, r: hex.r + vec.r, s: hex.s + vec.s }
}

export const cubeNeighbor = (cube: CubeCoords, direction: number) => {
  return cubeAdd(cube, cubeDirection(direction))
}

export const createRing = (center: AxialCoords, radius: number) => {
  const results = [] as { q: number; r: number }[]
  let hex = cubeAdd(
    { q: center.q, r: center.r, s: -center.q - center.r },
    cubeScale(cubeDirection(CubeDirection.Southeast), radius)
  )
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q: hex.q, r: hex.r })
      hex = cubeNeighbor(hex, i)
    }
  }
  return results
}

export const createSpiralGrid = (center: AxialCoords, radius: number) => {
  const results = [{ q: center.q, r: center.r }]
  for (let k = 1; k <= radius; k++) {
    results.push(...createRing(center, k))
  }
  return results
}

// from an input axial coordinate, return the pixel position of one of the hexagon's vertices (pointy top)
export const getHexVertexPosition = (hex: AxialCoords) => {
  const x = Math.sqrt(3) * (hex.q + hex.r / 2)
  const y = (3 / 2) * hex.r
  return { x: x, y: y }
}

export const axialToPixel = (hex: AxialCoords, hexWidth: number, hexRadius: number) => {
  const x = hexRadius * (hexWidth * hex.q + (hexWidth / 2) * hex.r)
  const z = hexRadius * ((3 / 2) * hex.r)
  return { x, z }
}
