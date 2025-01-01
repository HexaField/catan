import '@ir-engine/client/src/engine'

import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { NetworkID, useMutableState, useReactiveRef } from '@ir-engine/hyperflux'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'

import './hexes/HexagonGridSystem'
import './player/PlayerSystem'
import './game/GameSystem'
import './structures/StructureSystem'
import './structures/StructurePlacementSystem'

import { getComponent, setComponent } from '@ir-engine/ecs'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { CameraOrbitComponent } from '@ir-engine/spatial/src/camera/components/CameraOrbitComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import React, { useEffect } from 'react'
import { Vector3 } from 'three'

import { useFeathersClient, useP2PSignaling } from '@hexafield/ir-simple-api/src/client'

const serverHost = process.env['VITE_SERVER_HOST']
const serverPort = process.env['VITE_SERVER_PORT']

export default function Template() {
  const [ref, setRef] = useReactiveRef()

  useFeathersClient('https://' + serverHost + ':' + serverPort)
  useP2PSignaling('catan' as NetworkID)

  useSpatialEngine()
  useEngineCanvas(ref)

  const viewerEntity = useMutableState(EngineState).viewerEntity.value

  useEffect(() => {
    if (!viewerEntity) return
    setComponent(viewerEntity, CameraOrbitComponent)
    setComponent(viewerEntity, InputComponent)
    getComponent(viewerEntity, CameraComponent).position.set(0, 7, 8)
    getComponent(viewerEntity, CameraComponent).quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 4)
  }, [viewerEntity])

  useEffect(() => {
    // getMutableState(RendererState).gridVisibility.set(true)
  }, [])

  return (
    <>
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
