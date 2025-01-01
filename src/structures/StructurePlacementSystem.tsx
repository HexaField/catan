import {
  Entity,
  PresentationSystemGroup,
  QueryReactor,
  S,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineComponent,
  defineQuery,
  defineSystem,
  getComponent,
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
import { hexRadius, hexWidth } from '../hexes/HexagonGridConstants'
import { axialToPixel } from '../hexes/HexagonGridFunctions'
import { HexagonGridComponent, vertices } from '../hexes/HexagonGridSystem'
import { EdgeDirection, settlementGeometry } from './StructureSystem'

// const HelperLayer = 1

const StructureHelperComponent = defineComponent({
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

const getSelectedHelper = () => {
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

  return intersections[0]?.entity
}

const StructurePlacementState = defineState({
  name: 'StructurePlacementState',
  initial: {
    selectedStructure: UndefinedEntity
  },

  reactor: () => {
    const selectedStructure = useMutableState(StructurePlacementState).selectedStructure.value

    useEffect(() => {
      if (!selectedStructure) return

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
    }, [selectedStructure])
  }
})

export const StructurePlacementSystem = defineSystem({
  uuid: 'hexafield.catan.StructurePlacementSystem',
  insert: { after: PresentationSystemGroup },

  execute: () => {
    /** @todo make this networked */
    const helper = getSelectedHelper() ?? UndefinedEntity
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
    new Mesh(new BoxGeometry(0.2, 0.2), new MeshBasicMaterial({ side: DoubleSide, color: 'red', visible: false }))
  )
  addObjectToGroup(entity, getComponent(entity, MeshComponent))

  setComponent(entity, StructureHelperComponent, { coords, direction })
  setComponent(entity, InputComponent, { activationDistance: Infinity })

  return entity
}

const createCornerHelper = (coords: { q: number; r: number }, direction: 'N' | 'S') => {
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
    new Mesh(new SphereGeometry(), new MeshBasicMaterial({ side: DoubleSide, color: 'blue', visible: false }))
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
