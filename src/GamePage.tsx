import '@ir-engine/client/src/engine'

import './game/GameSystem'
import './hexes/HexagonGridSystem'
import './player/PlayerSystem'
import './resources/ResourceSystem'
import './structures/StructurePlacementSystem'
import './structures/StructurePurchaseSystem'
import './structures/StructureSystem'

import React, { useEffect } from 'react'
import { Vector3 } from 'three'

import Debug from '@ir-engine/client-core/src/components/Debug'
import { getComponent, setComponent } from '@ir-engine/ecs'
import { NetworkID, useMutableState, useReactiveRef } from '@ir-engine/hyperflux'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { CameraOrbitComponent } from '@ir-engine/spatial/src/camera/components/CameraOrbitComponent'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { useEngineCanvas } from '@ir-engine/spatial/src/renderer/functions/useEngineCanvas'

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
      <Debug />
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
