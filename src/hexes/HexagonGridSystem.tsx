import {
  Engine,
  Entity,
  PresentationSystemGroup,
  S,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineComponent,
  defineSystem,
  getComponent,
  getMutableComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { defineState, getMutableState, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { CameraOrbitComponent } from '@ir-engine/spatial/src/camera/components/CameraOrbitComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { RendererState } from '@ir-engine/spatial/src/renderer/RendererState'
import { RendererComponent } from '@ir-engine/spatial/src/renderer/WebGLRendererSystem'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { SceneComponent } from '@ir-engine/spatial/src/renderer/components/SceneComponents'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { createSpiralGrid } from './HexagonGridFunctions'

const hexDiameter = 1
const hexHeight = 2
const hexWidth = Math.sqrt(3)

export const HexagonGridState = defineState({
  name: 'hexafield.catan.HexagonGridState',
  initial: {
    gridWidthCount: 5,
    gridHeightCount: 5
  }
})

export const GridSystem = defineSystem({
  uuid: 'hexafield.catan.HexagonGridSystem',
  insert: { after: PresentationSystemGroup },
  execute: () => {
    //
  },
  reactor: function () {
    const viewerEntity = useMutableState(EngineState).viewerEntity.value

    useEffect(() => {
      if (!viewerEntity) return
      setComponent(viewerEntity, CameraOrbitComponent)
      setComponent(viewerEntity, InputComponent)
      getComponent(viewerEntity, CameraComponent).position.set(0, 3, 4)

      getMutableState(RendererState).gridVisibility.set(true)
    }, [viewerEntity])

    const originEntity = useMutableState(EngineState).originEntity.value
    const sceneEntity = useHookstate(UndefinedEntity)

    useEffect(() => {
      if (!originEntity || !viewerEntity) return

      const entity = createEntity()
      setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(entity, NameComponent, 'Catan Scene')
      setComponent(entity, TransformComponent)
      setComponent(entity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
      setComponent(entity, VisibleComponent)
      setComponent(entity, SceneComponent)
      sceneEntity.set(entity)

      getMutableComponent(viewerEntity, RendererComponent).scenes.merge([entity])

      return () => {
        sceneEntity.set(UndefinedEntity)
      }
    }, [originEntity, viewerEntity])

    if (!sceneEntity.value) return null

    return <GridBuilderReactor parentEntity={sceneEntity.value} />
  }
})

const hexGeom = new BufferGeometry()
// single hexagon outline base on consts defined above, along xz plane
// prettier-ignore
const vertices = [
  0, 0, 0, // center
  0, 0, hexHeight / 2, // top
  hexWidth / 2, 0, hexHeight / 4, // top right
  hexWidth / 2, 0, -hexHeight / 4, // bottom right
  0, 0, -hexHeight / 2, // bottom
  -hexWidth / 2, 0, -hexHeight / 4, // bottom left
  -hexWidth / 2, 0, hexHeight / 4, // top left
]
const indices = [1, 0, 2, 2, 0, 3, 3, 0, 4, 4, 0, 5, 5, 0, 6, 6, 0, 1]

hexGeom.setIndex(indices)
hexGeom.setAttribute('position', new Float32BufferAttribute(vertices, 3))

const colours = [
  'brown', // brick
  'gray', // ore
  'lime', // sheep
  'gold', // wheat
  'darkgreen', // log
  'tan' // desert
]

const GridBuilderReactor = (props: { parentEntity: Entity }) => {
  const { parentEntity } = props

  const { gridWidthCount, gridHeightCount } = useMutableState(HexagonGridState).value

  useEffect(() => {
    const gridCoords = createSpiralGrid({ q: 0, r: 0 }, 2)
    const grid = gridCoords.map(({ q, r }, i) => {
      const x = hexDiameter * (hexWidth * q + (hexWidth / 2) * r)
      const z = hexDiameter * ((3 / 2) * r)

      const entity = createEntity()
      setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(entity, NameComponent, `Hexagon ${i}`)
      setComponent(entity, TransformComponent, {
        position: new Vector3(x, 0, z),
        scale: new Vector3(hexDiameter, hexDiameter, hexDiameter)
      })
      setComponent(entity, EntityTreeComponent, { parentEntity })
      setComponent(entity, VisibleComponent)

      const color = colours[Math.floor(Math.random() * colours.length)]
      setComponent(entity, MeshComponent, new Mesh(hexGeom, new MeshBasicMaterial({ color, side: DoubleSide })))
      addObjectToGroup(entity, getComponent(entity, MeshComponent))

      setComponent(entity, HexagonGridComponent, { q, r })

      return entity
    })

    return () => {
      grid.forEach((entity) => {
        removeEntity(entity)
      })
    }
  }, [gridWidthCount, gridHeightCount, parentEntity])

  return null
}

const HexagonGridComponent = defineComponent({
  name: 'HexagonGridComponent',

  schema: S.Object({
    q: S.Number(),
    r: S.Number()
  })
})
