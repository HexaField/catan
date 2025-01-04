import {
  AnimationSystemGroup,
  defineSystem,
  entityExists,
  getComponent,
  hasComponent,
  removeEntity,
  setComponent,
  UUIDComponent
} from '@ir-engine/ecs'
import { createXRUI } from '@ir-engine/engine/src/xrui/createXRUI'
import { dispatchAction, getState, NO_PROXY, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import { Vector2 } from 'three'
import { HexagonGridComponent, ResourceByTile, ResourceType } from '../hexes/HexagonGridSystem'
import { getAdjacentHexesToStructure } from '../structures/StructureFunctions'
import { StructureState } from '../structures/StructureSystem'
import { GameActions, GameState, getMyColor, SetupActions } from './GameSystem'

const uiSize = new Vector2()
const uiScale = 0.25

export const DiceRollSystem = defineSystem({
  uuid: 'hexafield.catan.DiceRollSystem',
  insert: { with: AnimationSystemGroup },
  execute: () => {},
  reactor: () => {
    const { originEntity, viewerEntity } = useMutableState(EngineState).value

    if (!originEntity || !viewerEntity) return null

    return <DiceRollReactor />
  }
})
const DiceRollReactor = () => {
  const xrui = useHookstate(() => {
    const { entity, container } = createXRUI(RollButtonXRUI)

    setComponent(entity, TransformComponent)
    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Roll Dice Button XRUI')
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [getState(EngineState).viewerEntity],
      computeFunction: () => {
        const camera = getComponent(getState(EngineState).viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        const uiContainer = container.rootLayer.querySelector('#container')
        if (!uiContainer) return
        uiSize.set(uiContainer.domSize.x, uiContainer.domSize.y)
        ObjectFitFunctions.snapToSideOfScreen(
          entity,
          uiSize,
          uiScale,
          distance,
          0,
          0.8,
          getState(EngineState).viewerEntity
        )
      }
    })

    return entity
  }).value

  useEffect(() => {
    return () => {
      removeEntity(xrui)
    }
  }, [])

  const gameState = useMutableState(GameState)
  const currentPhase = gameState.currentPhase.value
  const myColor = getMyColor()
  const myTurnIndex = gameState.playerOrder.value.findIndex((player) => player.player === myColor)

  const active =
    (currentPhase === 'setup-roll' && myTurnIndex === -1) ||
    (currentPhase === 'roll' && gameState.currentPlayer.value === myColor)

  useEffect(() => {
    setVisibleComponent(xrui, active)
  }, [active])

  return null
}

const RollButtonXRUI = () => {
  const gameState = useMutableState(GameState)

  // clicked as a hackfix to prevent double-clicking
  const clicked = useHookstate(false)

  const onClick = () => {
    if (clicked.value) return
    clicked.set(true)
    if (gameState.currentPhase.value === 'setup-roll') setupRoll()
    else rollForResources()
  }

  useEffect(() => {
    clicked.set(false)
  }, [gameState.currentPhase.value])

  const message = gameState.currentPhase.value === 'setup-roll' ? 'Roll for Order' : 'Roll for Resources'

  return (
    <div id="container" xr-layer="true">
      <button style={{ width: '200px' }} onClick={onClick}>
        {message}
      </button>
    </div>
  )
}

const rollForResources = () => {
  const currentPlayer = getState(GameState).currentPlayer

  const dieRoll = [randomDiceRoll(), randomDiceRoll()]
  const combined = dieRoll.reduce((a, b) => a + b, 0)

  const newResources = {} as Record<ResourceType, number>

  const playerStructures = getState(StructureState)
    .structures.filter((s) => s.player === currentPlayer)
    .filter((s) => s.type === 'settlement' || s.type === 'city')

  for (const structure of playerStructures) {
    const adjacentHexes = getAdjacentHexesToStructure(structure)
    const stringCoords = adjacentHexes.filter(_filterNull).map((coords) => `${coords.q},${coords.r}`)
    const entities = stringCoords
      .map((coords) => HexagonGridComponent.coordsToEntity.get(NO_PROXY)[coords])
      .filter((e) => entityExists(e) && hasComponent(e, HexagonGridComponent))
    const hexes = entities.map((entity) => getComponent(entity, HexagonGridComponent))
    const hexesHitThisTurn = hexes.filter((hex) => hex.chance === combined)
    for (const hex of hexesHitThisTurn) {
      const resource = ResourceByTile[hex.tile]
      if (!resource) continue
      const count = structure.type === 'settlement' ? 1 : 2
      if (!newResources[resource]) newResources[resource] = count
      else newResources[resource] += count
    }
  }

  dispatchAction(
    GameActions.rollResources({
      player: currentPlayer,
      resources: newResources
    })
  )
}

const setupRoll = () => {
  const selfPlayer = getMyColor()
  const gameState = getState(GameState)
  if (gameState.playerOrder.find((player) => player.player === selfPlayer)) return
  const roll = [randomDiceRoll(), randomDiceRoll()]
  dispatchAction(SetupActions.rollForOrder({ player: selfPlayer, roll }))
}

const _filterNull = <T extends any>(x: T | null): x is T => x !== null

const randomDiceRoll = () => {
  return Math.floor(Math.random() * 6) + 1
}
