import {
  Entity,
  PresentationSystemGroup,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineSystem,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { useTexture } from '@ir-engine/engine/src/assets/functions/resourceLoaderHooks'
import { getState, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector2, Vector3 } from 'three'
import { GameState } from '../game/GameSystem'
import { ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors, PlayerColorsType } from '../player/PlayerSystem'

export const ResourceSystem = defineSystem({
  uuid: 'hexafield.catan.ResourceSystem',
  insert: { after: PresentationSystemGroup },

  reactor: () => {
    const gameState = useMutableState(GameState)
    const userID = useMutableState(EngineState).userID.value
    const myColor = PlayerColors.find((color) => gameState.playerColors.value[color] === userID)

    if (!myColor) return null

    return (
      <>
        <ResourceReactor key={myColor} myColor={myColor} />
      </>
    )
  }
})

const invertSort = (a, b) => (a > b ? -1 : a < b ? 1 : 0)

const contentSize = new Vector2(0.3, 0.4)
const contentScale = 0.1

const ResourceReactor = (props: { myColor: PlayerColorsType }) => {
  const { myColor } = props

  const resources = useMutableState(GameState).resources.value

  const parentEntity = useHookstate(UndefinedEntity)

  useEffect(() => {
    if (!resources[myColor]) return

    const entity = createEntity()
    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Resource Cards Parent')
    setComponent(entity, TransformComponent)
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [getState(EngineState).viewerEntity],
      computeFunction: () => {
        const camera = getComponent(getState(EngineState).viewerEntity, CameraComponent)
        const distance = camera.near * 2 // 10% in front of camera
        ObjectFitFunctions.snapToSideOfScreen(
          entity,
          contentSize,
          contentScale,
          distance,
          0.9,
          -1,
          getState(EngineState).viewerEntity
        )
      }
    })

    parentEntity.set(entity)
    return () => {
      removeEntity(entity)
      parentEntity.set(UndefinedEntity)
    }
  }, [!!resources[myColor]])

  if (!parentEntity.value) return null

  // turn the resources object into an array with duplicated entries for each resource
  const indexIterator = Object.entries(resources[myColor])
    .flatMap(([resource, count]) => Array(count).fill(resource))
    .sort(invertSort) as ResourceType[]

  return (
    <>
      {indexIterator.map((resource, i) => (
        <ResourceCard
          key={i}
          resource={resource}
          i={i}
          total={indexIterator.length}
          parentEntity={parentEntity.value}
        />
      ))}
    </>
  )
}

const ResourceCard = (props: { resource: ResourceType; i: number; total: number; parentEntity: Entity }) => {
  const entityState = useHookstate(UndefinedEntity)

  useEffect(() => {
    const entity = createEntity()
    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Resource Card ' + props.resource + ' ' + props.i)
    setComponent(entity, TransformComponent, {
      // splay the cards out
      rotation: new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (props.i / props.total) * Math.PI * 0.4 - Math.PI * 0.2
      )
    })
    setComponent(entity, EntityTreeComponent, { parentEntity: props.parentEntity })
    setComponent(entity, VisibleComponent)
    setComponent(
      entity,
      MeshComponent,
      new Mesh(new PlaneGeometry(0.3, 0.4).translate(0, 0.4, 0), new MeshBasicMaterial({ side: DoubleSide }))
    )
    entityState.set(entity)

    return () => {
      removeEntity(entity)
      entityState.set(UndefinedEntity)
    }
  }, [props.i, props.total])

  const [resource] = useTexture(`/${props.resource}.png`)

  useEffect(() => {
    if (!entityState.value) return
    if (resource) resource.colorSpace = SRGBColorSpace
    const material = getComponent(entityState.value, MeshComponent).material as MeshBasicMaterial
    material.map = resource
    material.needsUpdate = true
  }, [entityState.value, resource])

  return null
}
