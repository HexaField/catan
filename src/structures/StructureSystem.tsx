import {
  PresentationSystemGroup,
  UUIDComponent,
  createEntity,
  defineSystem,
  getComponent,
  removeEntity,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
import { defineState, getState, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { useEffect } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, Mesh, MeshLambertMaterial, Quaternion, Vector3 } from 'three'
import { hexRadius, hexWidth } from '../hexes/HexagonGridConstants'
import { axialToPixel } from '../hexes/HexagonGridFunctions'
import { HexagonGridComponent, vertices } from '../hexes/HexagonGridSystem'

const players = ['red', 'blue', 'white', 'orange']

const settlementHeight = 0.4
const settlementWidth = 0.6
const settlementLength = 0.8
const settlementRoofHeight = 0.4
const settlementRoofRadius = (settlementWidth * Math.sqrt(3)) / 3

const settlementGeometry = mergeBufferGeometries([
  // box
  new BoxGeometry(settlementWidth, settlementHeight, settlementLength).translate(0, settlementHeight / 2, 0),
  // peaked roof - triangular prism
  new CylinderGeometry(settlementRoofRadius, settlementRoofRadius, settlementLength, 3, 1, false)
    .rotateX(-Math.PI / 2)
    .scale(1, settlementRoofHeight, 1)
    .translate(0, settlementHeight + settlementRoofRadius * settlementRoofHeight * 0.5, 0)
])!
settlementGeometry.computeTangents()
settlementGeometry.computeVertexNormals()

export type CornerDirection = 'S' | 'N'

export type CornerType = {
  player: string
  type: 'settlement' | 'city'
  coords: { q: number; r: number; direction: CornerDirection }
}

export type EdgeDirection = 'E' | 'SE' | 'SW'

export type EdgeType = {
  player: string
  type: 'road'
  coords: { q: number; r: number; direction: EdgeDirection }
}

export type StructureDataType = CornerType | EdgeType

const testData: StructureDataType[] = [
  {
    player: 'red',
    type: 'settlement',
    coords: { q: 1, r: -1, direction: 'N' }
  },
  {
    player: 'red',
    type: 'road',
    coords: { q: 1, r: -2, direction: 'SE' }
  },
  {
    player: 'blue',
    type: 'settlement',
    coords: { q: -2, r: 2, direction: 'N' }
  },
  {
    player: 'blue',
    type: 'road',
    coords: { q: -2, r: 1, direction: 'E' }
  },
  {
    player: 'white',
    type: 'settlement',
    coords: { q: 2, r: -1, direction: 'S' }
  },
  {
    player: 'white',
    type: 'road',
    coords: { q: 1, r: 0, direction: 'E' }
  },
  {
    player: 'orange',
    type: 'settlement',
    coords: { q: -1, r: 0, direction: 'N' }
  },
  {
    player: 'orange',
    type: 'road',
    coords: { q: -1, r: -1, direction: 'E' }
  }
]

export const StructureState = defineState({
  name: 'hexafield.catan.StructureState',
  initial: {
    structures: testData
  }
})

export const StructureSystem = defineSystem({
  uuid: 'hexafield.catan.StructureSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    const gridReady = useQuery([HexagonGridComponent]).length > 0
    const originEntity = useMutableState(EngineState).originEntity.value

    useEffect(() => {
      if (!gridReady || !originEntity) return

      const radius = 1

      const coordinates = getState(StructureState).structures

      const starterSettlements = coordinates
        .filter((c) => c.type !== 'road')
        .map((coords, i) => {
          const settlementEntity = createEntity()
          setComponent(settlementEntity, UUIDComponent, UUIDComponent.generateUUID())
          setComponent(settlementEntity, NameComponent, `Settlement-${coords.player}`)

          const offset = axialToPixel(coords.coords, hexWidth, hexRadius)

          const vertexIndex = coords.coords.direction === 'N' ? 4 : 1

          setComponent(settlementEntity, TransformComponent, {
            position: new Vector3(offset.x + vertices[vertexIndex * 3], 0, offset.z + vertices[vertexIndex * 3 + 2]),
            scale: new Vector3().setScalar(0.4)
          })
          setComponent(settlementEntity, EntityTreeComponent, { parentEntity: originEntity })
          setComponent(settlementEntity, VisibleComponent)

          setComponent(
            settlementEntity,
            MeshComponent,
            new Mesh(settlementGeometry, new MeshLambertMaterial({ side: DoubleSide, color: coords.player }))
          )
          addObjectToGroup(settlementEntity, getComponent(settlementEntity, MeshComponent))

          return settlementEntity
        })

      const starterRoads = coordinates
        .filter((c) => c.type === 'road')
        .map((coords, i) => {
          const roadEntity = createEntity()
          setComponent(roadEntity, UUIDComponent, UUIDComponent.generateUUID())
          setComponent(roadEntity, NameComponent, `Road-${coords.player}`)

          const startPoint = axialToPixel(coords.coords, hexWidth, hexRadius)

          const direction = coords.coords.direction === 'E' ? 0 : coords.coords.direction === 'SE' ? 5 : 4
          const hexEdgeLength = hexRadius
          const angle = (direction * Math.PI) / 3
          const offset =
            coords.coords.direction === 'E'
              ? new Vector3(hexWidth, 0, 0)
              : coords.coords.direction === 'SE'
              ? new Vector3(hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))
              : new Vector3(-hexWidth / 2, 0, (hexWidth / 2) * Math.sqrt(3))

          setComponent(roadEntity, TransformComponent, {
            position: new Vector3(startPoint.x, 0, startPoint.z).add(offset.clone().multiplyScalar(hexEdgeLength / 2)),
            rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle)
          })
          setComponent(roadEntity, EntityTreeComponent, { parentEntity: originEntity })
          setComponent(roadEntity, VisibleComponent)

          const roadGeometry = new BoxGeometry(0.05, 0.05, hexEdgeLength).translate(0, 0.05, 0)

          setComponent(
            roadEntity,
            MeshComponent,
            new Mesh(roadGeometry, new MeshLambertMaterial({ side: DoubleSide, color: coords.player }))
          )
          addObjectToGroup(roadEntity, getComponent(roadEntity, MeshComponent))

          return roadEntity
        })

      return () => {
        for (const entity of starterSettlements) {
          removeEntity(entity)
        }
        for (const entity of starterRoads) {
          removeEntity(entity)
        }
      }
    }, [gridReady, originEntity])

    return null
  }
})
