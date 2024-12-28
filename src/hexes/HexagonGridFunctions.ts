/**
function cube_scale(hex, factor):
  return Cube(hex.q * factor, hex.r * factor, hex.s * factor)
*/

export const cubeScale = (hex: CubeCoords, factor: number) => {
  return { q: hex.q * factor, r: hex.r * factor, s: hex.s * factor }
}

/**
var cube_direction_vectors = [
  Cube(+1, +0, -1),
  Cube(+1, -1, +0),
  Cube(+0, -1, +1), 
  Cube(-1, +0, +1),
  Cube(-1, +1, +0),
  Cube(+0, +1, -1), 
]

function cube_direction(direction):
  return cube_direction_vectors[direction]

function cube_add(hex, vec):
  return Cube(hex.q + vec.q, hex.r + vec.r, hex.s + vec.s)

function cube_neighbor(cube, direction):
  return cube_add(cube, cube_direction(direction))
*/

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

/**
 * 
function cube_ring(center, radius):
  var results = []
  var hex = cube_add(center, cube_scale(cube_direction(0), radius))
  for each 0 ≤ i < 6:
    for each 0 ≤ j < radius:
      results.append(hex)
      hex = cube_neighbor(hex, i)
  return results
*/
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

/**
function cube_spiral(center, radius):
  var results = list(center)
  for each 1 ≤ k ≤ radius:
    results = list_append(results, cube_ring(center, k))
  return results
*/

export const createSpiralGrid = (center: AxialCoords, radius: number) => {
  const results = [{ q: center.q, r: center.r }]
  for (let k = 1; k <= radius; k++) {
    results.push(...createRing(center, k))
  }
  return results
}

type AxialCoords = { q: number; r: number }
type CubeCoords = { q: number; r: number; s: number }
