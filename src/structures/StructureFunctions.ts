import { CubeDirection, cubeNeighbor } from '../hexes/HexagonGridFunctions'
import { StructureDataType } from './StructureSystem'

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
