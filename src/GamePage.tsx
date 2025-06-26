import '@ir-engine/client/src/engine'

import './game/DiceRollSystem'
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
import { PeerToPeerNetworkState } from '@ir-engine/client-core/src/transports/p2p/PeerToPeerNetworkState'
import { useSimpleAPI } from '@ir-engine/client-core/src/util/useSimpleAPI'
import { InstanceID, LocationID } from '@ir-engine/common/src/schema.type.module'
import { getComponent, setComponent } from '@ir-engine/ecs'
import { useMutableState, useReactiveRef } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { CameraOrbitComponent } from '@ir-engine/spatial/src/camera/components/CameraOrbitComponent'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { ReferenceSpaceState } from '@ir-engine/spatial/src/ReferenceSpaceState'
import { useEngineCanvas } from '@ir-engine/spatial/src/renderer/functions/useEngineCanvas'

const serverHost = process.env['VITE_SERVER_HOST']
const serverPort = process.env['VITE_SERVER_PORT']

export default function Template() {
  const [ref, setRef] = useReactiveRef()

  useSimpleAPI('https://' + serverHost + ':' + serverPort)

  useSpatialEngine()
  useEngineCanvas(ref)

  const viewerEntity = useMutableState(ReferenceSpaceState).viewerEntity.value

  useEffect(() => {
    if (!viewerEntity) return
    setComponent(viewerEntity, CameraOrbitComponent)
    setComponent(viewerEntity, InputComponent)

    const cameraTransform = getComponent(viewerEntity, TransformComponent)
    cameraTransform.position.set(0, 7, 8)
    cameraTransform.rotation.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 4)
  }, [viewerEntity])

  useEffect(() => {
    // getMutableState(RendererState).gridVisibility.set(true)

    /** @todo add rooms */
    PeerToPeerNetworkState.connectToP2PInstance({
      id: 'catan' as InstanceID,
      locationId: 'catan' as LocationID
    })
  }, [])

  return (
    <>
      <Debug />
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
