import '@ir-engine/client/src/engine'

import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { getMutableState, useReactiveRef } from '@ir-engine/hyperflux'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'

import './hexes/HexagonGridSystem'
import './structures/StructureSystem'
import './player/PlayerSystem'

import { RendererState } from '@ir-engine/spatial/src/renderer/RendererState'
import React, { useEffect } from 'react'

export default function Template() {
  const [ref, setRef] = useReactiveRef()

  useSpatialEngine()
  useEngineCanvas(ref)

  useEffect(() => {
    // getMutableState(RendererState).gridVisibility.set(true)
  }, [])

  return (
    <>
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
