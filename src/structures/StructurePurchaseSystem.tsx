import {
  PresentationSystemGroup,
  UUIDComponent,
  defineSystem,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { createXRUI } from '@ir-engine/engine/src/xrui/createXRUI'
import { dispatchAction, getMutableState, getState, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { RendererComponent } from '@ir-engine/spatial/src/renderer/WebGLRendererSystem'
import { setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import { Vector2, Vector3 } from 'three'
import { GameActions, GameState, getMyColor, isCurrentPlayer } from '../game/GameSystem'
import { ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors } from '../player/PlayerSystem'
import { StructurePlacementState } from './StructurePlacementSystem'

export const StructurePurchaseSystem = defineSystem({
  uuid: 'hexafield.catan.StructurePurchaseSystem',
  insert: { after: PresentationSystemGroup },

  reactor: () => {
    const gameState = useMutableState(GameState)
    const userID = useMutableState(EngineState).userID.value
    const myColor = PlayerColors.find((color) => gameState.playerColors.value[color] === userID)

    if (!myColor) return null

    return (
      <>
        <StructurePurchaseReactor />
      </>
    )
  }
})

const SCREEN_SIZE = new Vector2()

const StructurePurchaseReactor = () => {
  const xrui = useHookstate(() => {
    const { entity, container } = createXRUI(StructurePurchaseXRUI)

    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Done Button XRUI')
    setComponent(entity, TransformComponent, {
      position: new Vector3(0, 0, -0.5),
      scale: new Vector3().setScalar(1)
    })
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })

    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [getState(EngineState).viewerEntity],
      computeFunction: () => {
        const camera = getComponent(getState(EngineState).viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        const uiContainer = container.rootLayer.querySelector('#container')
        if (!uiContainer) return
        const uiSize = uiContainer.domSize
        const screenSize = getComponent(getState(EngineState).viewerEntity, RendererComponent).renderer!.getSize(
          SCREEN_SIZE
        )
        const aspectRatio = screenSize.x / screenSize.y
        const scaleMultiplier = aspectRatio < 1 ? 1 / aspectRatio : 1
        const scale =
          ObjectFitFunctions.computeContentFitScaleForCamera(distance, uiSize.x, uiSize.y, 'contain') *
          0.25 *
          scaleMultiplier
        ObjectFitFunctions.attachObjectInFrontOfCamera(entity, scale, distance)
      }
    })

    return entity
  }).value

  useEffect(() => {
    return () => {
      removeEntity(xrui)
    }
  }, [])

  const state = useMutableState(GameState).value
  const currentPlayer = isCurrentPlayer(getState(EngineState).userID)
  const isBuildPhase = state.currentPhase === 'build'

  useEffect(() => {
    setVisibleComponent(xrui, currentPlayer && isBuildPhase)
  }, [currentPlayer && isBuildPhase])

  return null
}

const StructurePurchaseXRUI = () => {
  return (
    <>
      <div style={cardStyle} xr-layer="true">
        Building Costs
        <Section structure="Road" resources={['Lumber', 'Brick']} />
        <Section structure="Settlement" resources={['Lumber', 'Brick', 'Grain', 'Wool']} />
        <Section structure="City" resources={['Grain', 'Grain', 'Ore', 'Ore', 'Ore']} />
        <Section structure="Development Card" resources={['Grain', 'Wool', 'Ore']} />
      </div>
    </>
  )
}

const Section = (props: { structure: string; resources: ResourceType[] }) => {
  const gameState = useMutableState(GameState).value

  const color = getMyColor()
  const currentResources = gameState.resources[color]
  const cost = props.resources.reduce(
    (acc, resource) => {
      if (!acc[resource]) acc[resource] = 0
      acc[resource] += 1
      return acc
    },
    {} as Record<ResourceType, number>
  )
  const hasResources =
    currentResources && Object.entries(cost).every(([resource, count]) => currentResources[resource] >= count)

  // clicked as a hackfix to prevent double-clicking
  const clicked = useHookstate(false)

  const onClick = () => {
    if (clicked.value) return
    clicked.set(true)
    if (!hasResources) return
    dispatchAction(
      GameActions.purchaseItem({
        player: gameState.currentPlayer,
        cost
      })
    )
    if (props.structure === 'Road') getMutableState(StructurePlacementState).active.merge(['road'])
    if (props.structure === 'Settlement') getMutableState(StructurePlacementState).active.merge(['settlement'])
    if (props.structure === 'City') getMutableState(StructurePlacementState).active.merge(['city'])
  }

  useEffect(() => {
    clicked.set(false)
  }, [gameState])

  return (
    <div onClick={onClick} style={sectionStyle} id="container" xr-layer="true">
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: hasResources ? '#FAFAFA' : '#F0F0F0',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {props.structure}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
            {props.resources.map((resource, i) => (
              <img key={resource + i} src={`/${resource}.png`} style={{ width: '20px' }} />
            ))}
          </div>
        </div>
        {/* <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
          <img src={`/${props.structure}.png`} style={{ width: '20px' }} />
        </div> */}
      </div>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: 'white',
  padding: '0.5em',
  border: '1px solid black'
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '200px',
  justifyContent: 'space-between',
  backgroundColor: 'white',
  padding: '0.5em',
  border: '1px solid black'
}
