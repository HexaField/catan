import {
  Entity,
  InputSystemGroup,
  QueryReactor,
  S,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineComponent,
  defineQuery,
  defineSystem,
  getComponent,
  hasComponent,
  removeEntity,
  setComponent,
  useComponent,
  useEntityContext
} from '@ir-engine/ecs'
import { NO_PROXY, defineState, getMutableState, getState, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { InputSourceComponent } from '@ir-engine/spatial/src/input/components/InputSourceComponent'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'
import { getMyColor, isCurrentPlayer } from '../game/GameSystem'
import { hexRadius, hexWidth } from '../hexes/HexagonGridConstants'
import { axialToPixel } from '../hexes/HexagonGridFunctions'
import { HexagonGridComponent, vertices } from '../hexes/HexagonGridSystem'
import {
  getAdjacentCornersToCorner,
  getAdjacentCornersToEdge,
  getAdjacentEdgesToCorner,
  getAdjacentEdgesToEdge
} from './StructureFunctions'
import { CornerDirection, EdgeDirection, StructureState, settlementGeometry } from './StructureSystem'

const helpersVisible = false

export const StructureHelperComponent = defineComponent({
  name: 'StructureHelperComponent',
  schema: S.Object({
    coords: S.Object({
      q: S.Number(),
      r: S.Number()
    }),
    direction: S.String()
  })
})

const structureHelperQuery = defineQuery([StructureHelperComponent, MeshComponent])

const getValidSelectedHelper = () => {
  if (!isCurrentPlayer(getState(EngineState).userID)) return

  const helpers = structureHelperQuery()
  if (!helpers.length) return

  const inputSources = helpers
    .map((entity) => getComponent(entity, InputComponent).inputSources)
    .flat()
    .reduce((acc, val) => {
      if (!acc.includes(val)) acc.push(val)
      return acc
    }, [] as Entity[])

  const intersections = inputSources
    .map((entity) => getComponent(entity, InputSourceComponent).intersections)
    .flat()
    .filter((input) => input.distance > 0)

  if (!intersections.length) return

  const selectedEntity = intersections[0]?.entity

  if (!selectedEntity || !hasComponent(selectedEntity, StructureHelperComponent)) return

  const active = getState(StructurePlacementState).active

  // validate placement
  const helperComponent = getComponent(selectedEntity, StructureHelperComponent)

  const isRoad =
    helperComponent.direction === 'E' || helperComponent.direction === 'SE' || helperComponent.direction === 'SW'

  if (isRoad && !active.includes('road')) return
  if (!isRoad && active.includes('road')) return

  const coords = {
    q: helperComponent.coords.q,
    r: helperComponent.coords.r,
    direction: helperComponent.direction as CornerDirection & EdgeDirection
  }

  // ensure no structure is already placed here, or within 1 edge of here
  /** @todo this can be optimized by caching the structure locations */

  const structures = getState(StructureState).structures
  const existingStructure = structures.find(
    (structure) =>
      structure.coords.q === coords.q &&
      structure.coords.r === coords.r &&
      structure.coords.direction === coords.direction
  )
  if (existingStructure) {
    if (!isRoad && !active.includes('city')) return

    /** @todo upgrade city */
    return // return selectedEntity
  }

  const coordsMatchStructure = (c: typeof coords) =>
    structures.filter(
      (structure) =>
        structure.coords.q === c.q && structure.coords.r === c.r && structure.coords.direction === c.direction
    )

  const adjacentRoadCoords = isRoad ? getAdjacentEdgesToEdge(coords) : getAdjacentEdgesToCorner(coords)
  const adjacentCornerCoords = isRoad ? getAdjacentCornersToEdge(coords) : getAdjacentCornersToCorner(coords)
  const adjacentRoads = adjacentRoadCoords.map(coordsMatchStructure).flat()
  const adjacentCorners = adjacentCornerCoords.map(coordsMatchStructure).flat()
  // const myRoads = structures.filter((structure) => structure.type === 'road' && structure.player === myColor)
  // const mySettlements = structures.filter((structure) => structure.type !== 'road' && structure.player === myColor)

  const myColor = getMyColor()

  if (isRoad) {
    // road requirement is that there a road within 1 edge or a settlement within 1 corner
    const hasAdjacentRoad = adjacentRoads.find((edge) => myColor === edge.player)
    const hasAdjacentCorner = adjacentCorners.find((corner) => myColor === corner.player)
    if (!hasAdjacentRoad && !hasAdjacentCorner) return
  } else {
    // settlement requirement is that there is no settlement within 1 corner
    const hasAdjacentCorner = adjacentCorners.length > 0
    if (hasAdjacentCorner) return
  }

  return selectedEntity
}

export const StructurePlacementState = defineState({
  name: 'StructurePlacementState',
  initial: {
    active: [] as Array<'settlement' | 'city' | 'road'>,
    selectedStructure: UndefinedEntity
  },

  reactor: () => {
    const { selectedStructure, active } = useMutableState(StructurePlacementState).value

    useEffect(() => {
      if (!selectedStructure || !active.length) return

      const structureHelper = getComponent(selectedStructure, StructureHelperComponent)

      const { coords, direction } = structureHelper

      const isRoad = direction === 'E' || direction === 'SE' || direction === 'SW'

      const hexCenter = axialToPixel(coords, hexWidth, hexRadius)
      const position = new Vector3()
      const rotation = new Quaternion()

      if (isRoad) {
        const directionIndex = direction === 'E' ? 0 : direction === 'SE' ? 5 : 4
        const hexEdgeLength = hexRadius
        const angle = (directionIndex * Math.PI) / 3
        const offset =
          direction === 'E'
            ? new Vector3(hexWidth, 0, 0)
            : direction === 'SE'
            ? new Vector3(hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))
            : new Vector3(-hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))
        position.set(hexCenter.x, 0, hexCenter.z).add(offset.clone().multiplyScalar(hexEdgeLength / 2))
        rotation.setFromAxisAngle(new Vector3(0, 1, 0), angle)
      } else {
        const vertexIndex = direction === 'N' ? 4 : 1
        position.set(hexCenter.x + vertices[vertexIndex * 3], 0, hexCenter.z + vertices[vertexIndex * 3 + 2])
      }

      const structureEntity = createEntity()
      setComponent(structureEntity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(structureEntity, NameComponent, 'Structure')
      setComponent(structureEntity, TransformComponent, {
        position: position,
        rotation
      })
      setComponent(structureEntity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
      setComponent(structureEntity, VisibleComponent)
      setComponent(
        structureEntity,
        MeshComponent,
        new Mesh(
          isRoad ? new BoxGeometry(0.05, 0.05) : settlementGeometry.clone(),
          new MeshBasicMaterial({ color: 'green', transparent: true, opacity: 0.5 })
        )
      )
      addObjectToGroup(structureEntity, getComponent(structureEntity, MeshComponent))

      return () => {
        removeEntity(structureEntity)
      }
    }, [selectedStructure, active])
  }
})

export const StructurePlacementSystem = defineSystem({
  uuid: 'hexafield.catan.StructurePlacementSystem',
  insert: { with: InputSystemGroup },

  execute: () => {
    /** @todo make this networked */
    const helper = getValidSelectedHelper() ?? UndefinedEntity
    getMutableState(StructurePlacementState).selectedStructure.set(helper)
  },

  reactor: () => {
    return (
      <>
        <QueryReactor Components={[HexagonGridComponent]} ChildEntityReactor={PlacementHelperReactor} />
      </>
    )
  }
})

const createEdgeHelper = (coords: { q: number; r: number }, direction: EdgeDirection) => {
  const startPoint = axialToPixel(coords, hexWidth, hexRadius)

  const directionIndex = direction === 'E' ? 0 : direction === 'SE' ? 5 : 4
  const hexEdgeLength = hexRadius
  const angle = (directionIndex * Math.PI) / 3
  const offset =
    direction === 'E'
      ? new Vector3(hexWidth, 0, 0)
      : direction === 'SE'
      ? new Vector3(hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))
      : new Vector3(-hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))

  const entity = createEntity()
  setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
  setComponent(entity, NameComponent, `Edge Helper ${coords.q},${coords.r} ${direction}`)
  setComponent(entity, TransformComponent, {
    position: new Vector3(startPoint.x, 0, startPoint.z).add(offset.clone().multiplyScalar(hexEdgeLength / 2)),
    rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle)
  })
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
  setComponent(entity, VisibleComponent)
  setComponent(
    entity,
    MeshComponent,
    new Mesh(
      new BoxGeometry(0.2, 0.2),
      new MeshBasicMaterial({ side: DoubleSide, color: 'red', visible: helpersVisible })
    )
  )
  addObjectToGroup(entity, getComponent(entity, MeshComponent))

  setComponent(entity, StructureHelperComponent, { coords, direction })
  setComponent(entity, InputComponent, { activationDistance: Infinity })

  return entity
}

const createCornerHelper = (coords: { q: number; r: number }, direction: CornerDirection) => {
  const offset = axialToPixel(coords, hexWidth, hexRadius)

  const vertexIndex = direction === 'N' ? 4 : 1

  const entity = createEntity()
  setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
  setComponent(entity, NameComponent, `Corner Helper ${coords.q},${coords.r} ${direction}`)
  setComponent(entity, TransformComponent, {
    position: new Vector3(offset.x + vertices[vertexIndex * 3], 0, offset.z + vertices[vertexIndex * 3 + 2]),
    scale: new Vector3().setScalar(0.2)
  })
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
  setComponent(entity, VisibleComponent)
  setComponent(
    entity,
    MeshComponent,
    new Mesh(new SphereGeometry(), new MeshBasicMaterial({ side: DoubleSide, color: 'blue', visible: helpersVisible }))
  )
  addObjectToGroup(entity, getComponent(entity, MeshComponent))

  setComponent(entity, StructureHelperComponent, { coords, direction })
  setComponent(entity, InputComponent, { activationDistance: Infinity })

  return entity
}

// add helpers on all 6 edges and all 6 corners, deduplicating by coords
const PlacementHelperReactor = () => {
  const entity = useEntityContext()
  const { coords } = useComponent(entity, HexagonGridComponent).get(NO_PROXY)

  const hasWestHex = useHookstate(HexagonGridComponent.coordsToEntity[`${coords.q - 1},${coords.r}`]).value
  const hasNorthWestHex = useHookstate(HexagonGridComponent.coordsToEntity[`${coords.q},${coords.r - 1}`]).value
  const hasNorthEastHex = useHookstate(HexagonGridComponent.coordsToEntity[`${coords.q + 1},${coords.r - 1}`]).value
  const hasSouthEastHex = useHookstate(HexagonGridComponent.coordsToEntity[`${coords.q},${coords.r + 1}`]).value
  const hasSouthWestHex = useHookstate(HexagonGridComponent.coordsToEntity[`${coords.q - 1},${coords.r + 1}`]).value

  // edge helpers

  useEffect(() => {
    const eastHelperEntity = createEdgeHelper(coords, 'E')
    const southEastHelperEntity = createEdgeHelper(coords, 'SE')
    const southWestHelperEntity = createEdgeHelper(coords, 'SW')
    return () => {
      removeEntity(eastHelperEntity)
      removeEntity(southEastHelperEntity)
      removeEntity(southWestHelperEntity)
    }
  }, [])

  // conditionally add west, northWest, northEast helpers if the adjacent hexes are not present

  useEffect(() => {
    if (hasWestHex) return

    const westHelperEntity = createEdgeHelper({ q: coords.q - 1, r: coords.r }, 'E')
    return () => {
      removeEntity(westHelperEntity)
    }
  }, [hasWestHex])

  useEffect(() => {
    if (hasNorthWestHex) return

    const northWestHelperEntity = createEdgeHelper({ q: coords.q, r: coords.r - 1 }, 'SE')
    return () => {
      removeEntity(northWestHelperEntity)
    }
  }, [hasNorthWestHex])

  useEffect(() => {
    if (hasNorthEastHex) return

    const northEastHelperEntity = createEdgeHelper({ q: coords.q + 1, r: coords.r - 1 }, 'SW')
    return () => {
      removeEntity(northEastHelperEntity)
    }
  }, [hasNorthEastHex])

  // corner helpers

  useEffect(() => {
    const northHelperEntity = createCornerHelper(coords, 'N')
    const southHelperEntity = createCornerHelper(coords, 'S')
    return () => {
      removeEntity(northHelperEntity)
      removeEntity(southHelperEntity)
    }
  }, [])

  // conditionally add northWest, northEast, southWest, southEast helpers if the adjacent hexes are not present

  useEffect(() => {
    if (hasNorthWestHex) return

    const northWestHelperEntity = createCornerHelper({ q: coords.q, r: coords.r - 1 }, 'S')
    return () => {
      removeEntity(northWestHelperEntity)
    }
  }, [hasNorthWestHex])

  useEffect(() => {
    if (hasNorthEastHex) return

    const northEastHelperEntity = createCornerHelper({ q: coords.q + 1, r: coords.r - 1 }, 'S')
    return () => {
      removeEntity(northEastHelperEntity)
    }
  }, [hasNorthEastHex])

  useEffect(() => {
    if (hasSouthEastHex) return

    const southEastHelperEntity = createCornerHelper({ q: coords.q, r: coords.r + 1 }, 'N')
    return () => {
      removeEntity(southEastHelperEntity)
    }
  }, [hasSouthEastHex])

  useEffect(() => {
    if (hasSouthWestHex) return

    const southWestHelperEntity = createCornerHelper({ q: coords.q - 1, r: coords.r + 1 }, 'N')
    return () => {
      removeEntity(southWestHelperEntity)
    }
  }, [hasSouthWestHex])

  return null
}
