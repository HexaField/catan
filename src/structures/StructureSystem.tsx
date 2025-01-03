import {
  PresentationSystemGroup,
  UUIDComponent,
  createEntity,
  defineSystem,
  removeEntity,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
import { defineState, getState, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, Mesh, MeshLambertMaterial, Quaternion, Vector3 } from 'three'
import { hexRadius, hexWidth } from '../hexes/HexagonGridConstants'
import { axialToPixel } from '../hexes/HexagonGridFunctions'
import { HexagonGridComponent, vertices } from '../hexes/HexagonGridSystem'
import { PlayerColorsType } from '../player/PlayerSystem'

const settlementHeight = 0.4
const settlementWidth = 0.6
const settlementLength = 0.8
const settlementRoofHeight = 0.4
const settlementRoofRadius = (settlementWidth * Math.sqrt(3)) / 3

export const settlementGeometry = mergeBufferGeometries([
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
settlementGeometry.scale(0.4, 0.4, 0.4)

export type CornerDirection = 'S' | 'N'

export type CornerType = {
  player: PlayerColorsType
  type: 'settlement' | 'city'
  coords: { q: number; r: number; direction: CornerDirection }
}

export type EdgeDirection = 'E' | 'SE' | 'SW'

export type EdgeType = {
  player: PlayerColorsType
  type: 'road'
  coords: { q: number; r: number; direction: EdgeDirection }
}

export type StructureDataType = CornerType | EdgeType

export const StructureState = defineState({
  name: 'hexafield.catan.StructureState',
  initial: {
    structures: [] as StructureDataType[]
  }
})

export const StructureSystem = defineSystem({
  uuid: 'hexafield.catan.StructureSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    const gridReady = useQuery([HexagonGridComponent]).length > 0
    const originEntity = useMutableState(EngineState).originEntity.value
    const structures = useMutableState(StructureState).structures.value

    if (!gridReady || !originEntity) return null

    return (
      <>
        {structures.map((structure, i) => (
          <StructureReactor key={i} data={structure} />
        ))}
      </>
    )
  }
})

const StructureReactor = (props: { data: StructureDataType }) => {
  const { data } = props

  useEffect(() => {
    const originEntity = getState(EngineState).originEntity

    if (data.type === 'settlement') {
      const settlementEntity = createEntity()
      setComponent(settlementEntity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(settlementEntity, NameComponent, `Settlement-${data.player}`)

      const offset = axialToPixel(data.coords, hexWidth, hexRadius)

      const vertexIndex = data.coords.direction === 'N' ? 4 : 1

      setComponent(settlementEntity, TransformComponent, {
        position: new Vector3(offset.x + vertices[vertexIndex * 3], 0, offset.z + vertices[vertexIndex * 3 + 2])
      })
      setComponent(settlementEntity, EntityTreeComponent, { parentEntity: originEntity })
      setComponent(settlementEntity, VisibleComponent)

      setComponent(
        settlementEntity,
        MeshComponent,
        new Mesh(settlementGeometry.clone(), new MeshLambertMaterial({ side: DoubleSide, color: data.player }))
      )

      return () => {
        removeEntity(settlementEntity)
      }
    }

    if (data.type === 'road') {
      const roadEntity = createEntity()
      setComponent(roadEntity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(roadEntity, NameComponent, `Road-${data.player}`)

      const startPoint = axialToPixel(data.coords, hexWidth, hexRadius)

      const direction = data.coords.direction === 'E' ? 0 : data.coords.direction === 'SE' ? 5 : 4
      const hexEdgeLength = hexRadius
      const angle = (direction * Math.PI) / 3
      const offset =
        data.coords.direction === 'E'
          ? new Vector3(hexWidth, 0, 0)
          : data.coords.direction === 'SE'
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
        new Mesh(roadGeometry, new MeshLambertMaterial({ side: DoubleSide, color: data.player }))
      )

      return () => {
        removeEntity(roadEntity)
      }
    }
  }, [])

  return null
}
