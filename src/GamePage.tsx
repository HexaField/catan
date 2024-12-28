import '@ir-engine/client/src/engine'

import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { useReactiveRef } from '@ir-engine/hyperflux'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'

import './hexes/HexagonGridSystem'

import React from 'react'

export default function Template() {
  const [ref, setRef] = useReactiveRef()

  useSpatialEngine()
  useEngineCanvas(ref)

  return (
    <>
      <div ref={setRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
