import '@ir-engine/client/src/engine'

import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { UndefinedEntity, createEntity, defineSystem, getComponent, setComponent } from '@ir-engine/ecs'
import { ECSState } from '@ir-engine/ecs/src/ECSState'
import { Engine } from '@ir-engine/ecs/src/Engine'
import {
  defineState,
  getMutableState,
  getState,
  useImmediateEffect,
  useMutableState,
  useReactiveRef
} from '@ir-engine/hyperflux'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { Vector3_Up } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { destroySpatialEngine, initializeSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import { TransformSystem, computeTransformMatrix } from '@ir-engine/spatial/src/transform/systems/TransformSystem'

import React, { useEffect } from 'react'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'

const SceneState = defineState({
  name: 'ee.minimalist.SceneState',
  initial: {
    entity: UndefinedEntity
  }
})

const UpdateSystem = defineSystem({
  uuid: 'ee.minimalist.UpdateSystem',
  insert: { before: TransformSystem },
  execute: () => {
    const entity = getState(SceneState).entity
    if (!entity) return

    const elapsedSeconds = getState(ECSState).elapsedSeconds
    const transformComponent = getComponent(entity, TransformComponent)
    transformComponent.rotation.setFromAxisAngle(Vector3_Up, elapsedSeconds)
  },
  reactor: function () {
    const viewerEntity = useMutableState(EngineState).viewerEntity.value

    useEffect(() => {
      if (!viewerEntity) return

      // Create a new entity
      const entity = createEntity()
      setComponent(entity, TransformComponent)
      setComponent(entity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })

      // Create a box at the origin
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0x00ff00 }))
      addObjectToGroup(entity, mesh)
      setComponent(entity, NameComponent, 'Box')
      setComponent(entity, VisibleComponent)

      // Make the camera look at the box
      const cameraTransform = getComponent(viewerEntity, TransformComponent)
      const camera = getComponent(viewerEntity, CameraComponent)
      cameraTransform.position.set(5, 2, 0)
      cameraTransform.rotation.copy(camera.quaternion)
      computeTransformMatrix(viewerEntity)
      camera.lookAt(0, 0, 0)

      getMutableState(SceneState).entity.set(entity)
    }, [viewerEntity])

    return null
  }
})

export default function Template() {
  const [ref, setRef] = useReactiveRef()

  useImmediateEffect(() => {
    initializeSpatialEngine()
    return () => {
      destroySpatialEngine()
    }
  }, [])

  useEngineCanvas(ref)

  return (
    <>
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
