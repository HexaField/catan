import {
  AnimationSystemGroup,
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
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { GameState } from '../game/GameSystem'
import { ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors, PlayerColorsType } from '../player/PlayerSystem'

export const ResourceSystem = defineSystem({
  uuid: 'hexafield.catan.ResourceSystem',
  insert: { with: AnimationSystemGroup },

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

const ResourceReactor = (props: { myColor: PlayerColorsType }) => {
  const { myColor } = props

  const resources = useMutableState(GameState).resources.value

  if (!resources[myColor]) return null

  // turn the resources object into an array with duplicated entries for each resource
  const indexIterator = Object.entries(resources[myColor]).flatMap(([resource, count]) =>
    Array(count).fill(resource)
  ) as ResourceType[]

  return (
    <>
      {indexIterator.map((resource, i) => (
        <ResourceCard key={i} resource={resource} i={i} total={indexIterator.length} />
      ))}
    </>
  )
}

const ResourceCard = (props: { resource: ResourceType; i: number; total: number }) => {
  const entityState = useHookstate(UndefinedEntity)

  useEffect(() => {
    const entity = createEntity()
    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Resource Card')
    setComponent(entity, TransformComponent, {
      position: new Vector3(0.15, -0.2, -0.5),
      // splay the cards out
      rotation: new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (props.i / props.total) * Math.PI * 0.4 - Math.PI * 0.2
      ),
      scale: new Vector3().setScalar(0.25)
    })
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).viewerEntity })
    setComponent(entity, VisibleComponent)
    setComponent(
      entity,
      MeshComponent,
      new Mesh(new PlaneGeometry(0.3, 0.4).translate(0, 0.4, 0), new MeshBasicMaterial({ side: DoubleSide }))
    )
    addObjectToGroup(entity, getComponent(entity, MeshComponent))
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
