import {
  InputSystemGroup,
  UUIDComponent,
  defineSystem,
  entityExists,
  getComponent,
  hasComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { createXRUI } from '@ir-engine/engine/src/xrui/createXRUI'
import {
  NO_PROXY,
  UserID,
  Validator,
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  matches,
  none,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { NetworkTopics, matchesUserID } from '@ir-engine/network'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import { Vector2 } from 'three'
import { HexagonGridComponent, ResourceByTile, ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors, PlayerColorsType, PlayerState } from '../player/PlayerSystem'
import { getAdjacentHexesToStructure } from '../structures/StructureFunctions'
import { StructureHelperComponent, StructurePlacementState } from '../structures/StructurePlacementSystem'
import { CornerDirection, EdgeDirection, StructureDataType, StructureState } from '../structures/StructureSystem'
import { TransformComponent } from '@ir-engine/spatial'

const _filterNull = <T extends any>(x: T | null): x is T => x !== null

const randomDiceRoll = () => {
  return Math.floor(Math.random() * 6) + 1
}

const chooseColor = () => {
  const playerColors = getState(GameState).playerColors
  const selfColor = getMyColor()
  if (selfColor) return
  // this will be replaced with UI eventually
  // for now, just auto-choose the next color
  const nextColor = PlayerColors.find((color) => !playerColors[color])
  if (nextColor) {
    const userID = getState(EngineState).userID
    dispatchAction(SetupActions.chooseColor({ userID, color: nextColor }))
  }
}

const setupRoll = () => {
  const selfPlayer = getMyColor()
  const gameState = getState(GameState)
  if (gameState.playerOrder.find((player) => player.player === selfPlayer)) return
  const roll = [randomDiceRoll(), randomDiceRoll()]
  console.log('Rolled a', roll[0] + roll[1])
  dispatchAction(SetupActions.rollForOrder({ player: selfPlayer, roll }))
}

const placeStructure = () => {
  const currentPlayer = getState(GameState).currentPlayer
  const { active, selectedStructure } = getState(StructurePlacementState)
  if (!active.length || !selectedStructure) return
  const { coords, direction } = getComponent(selectedStructure, StructureHelperComponent)
  const isCorner = direction === 'N' || direction === 'S'
  if (isCorner) {
    getMutableState(StructurePlacementState).active[active.indexOf('settlement')].set(none)
    dispatchAction(
      GameActions.buildSettlement({
        player: currentPlayer,
        coords: { q: coords.q, r: coords.r, direction: direction as CornerDirection }
      })
    )
  } else {
    getMutableState(StructurePlacementState).active[active.indexOf('road')].set(none)
    dispatchAction(
      GameActions.buildRoad({
        player: currentPlayer,
        coords: { q: coords.q, r: coords.r, direction: direction as EdgeDirection }
      })
    )
  }
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

export const GameSystem = defineSystem({
  uuid: 'hexafield.catan.GameSystem',
  insert: { with: InputSystemGroup },
  execute: () => {
    const viewerEntity = getState(EngineState).viewerEntity
    if (!viewerEntity) return

    const playersReady = getState(PlayerState).playersReady
    if (!playersReady) return

    const buttons = InputComponent.getMergedButtons(viewerEntity)

    const currentPhase = getState(GameState).currentPhase

    if (currentPhase === 'choose-colors') {
      if (buttons.KeyK?.down) chooseColor()
      return
    }

    if (currentPhase === 'setup-roll') {
      if (buttons.KeyK?.down) setupRoll()
      return
    }

    if (!isCurrentPlayer(getState(EngineState).userID)) return

    if (currentPhase === 'setup-first' || currentPhase === 'setup-second' || currentPhase === 'build') {
      if (buttons.PrimaryClick?.up) placeStructure()
      return
    }

    if (currentPhase === 'roll') {
      if (buttons.KeyK?.down) rollForResources()
      return
    }

    // if (currentPhase === 'trade') {
    //   // todo
    //   dispatchAction(GameActions.doneTrading({ player: getMyColor() }))
    //   return
    // }
  }
})

export const isCurrentPlayer = (userID: UserID) => {
  return getState(GameState).playerColors[getState(GameState).currentPlayer] === userID
}

export const getMyColor = () => {
  const userID = getState(EngineState).userID
  const playerColors = getState(GameState).playerColors
  return PlayerColors.find((color) => playerColors[color] === userID)!
}

const Phases = ['choose-colors', 'setup-roll', 'setup-first', 'setup-second', 'roll', 'trade', 'build'] as const
export type PhaseTypes = (typeof Phases)[number]

export type PlayerResources = Record<ResourceType, number>

/**

Setup Phase
- Choose colour
- Roll to find player order
- Place first settlement
- Place second settlement

Player Turn
- Roll die to collect resources
- Trade w other users & trade with bank
- Build
- Done
- Can optionally play card any time from before rolling die to before 
hitting done

*/

const matchesPlayerColors = matches.literals('red', 'blue', 'white', 'orange')
const matchesResources = matches.object as Validator<unknown, PlayerResources>

export const SetupActions = {
  chooseColor: defineAction({
    type: 'hexafield.catan.SetupActions.chooseColor',
    userID: matchesUserID,
    color: matchesPlayerColors,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  rollForOrder: defineAction({
    type: 'hexafield.catan.SetupActions.rollForOrder',
    player: matchesPlayerColors,
    roll: matches.arrayOf(matches.number),
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export const GameActions = {
  rollResources: defineAction({
    type: 'hexafield.catan.GameActions.rollDice',
    player: matchesPlayerColors,
    resources: matchesResources,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  requestTrade: defineAction({
    type: 'hexafield.catan.GameActions.requestTrade',
    player: matchesPlayerColors,
    give: matchesResources,
    receive: matchesResources,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  acceptTrade: defineAction({
    type: 'hexafield.catan.GameActions.acceptTrade',
    player: matchesPlayerColors,
    give: matchesResources,
    receive: matchesResources,
    accepted: matches.boolean,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  doneTrading: defineAction({
    type: 'hexafield.catan.GameActions.doneTrading',
    player: matchesPlayerColors,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  purchaseItem: defineAction({
    type: 'hexafield.catan.GameActions.purchaseItem',
    player: matchesPlayerColors,
    // item: matches.literals('road', 'settlement', 'city', 'development-card'),
    cost: matchesResources,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  buildRoad: defineAction({
    type: 'hexafield.catan.GameActions.buildRoad',
    player: matchesPlayerColors,
    coords: matches.object as Validator<unknown, { q: number; r: number; direction: EdgeDirection }>,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  buildSettlement: defineAction({
    type: 'hexafield.catan.GameActions.buildSettlement',
    player: matchesPlayerColors,
    coords: matches.object as Validator<unknown, { q: number; r: number; direction: CornerDirection }>,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  buildCity: defineAction({
    type: 'hexafield.catan.GameActions.buildCity',
    player: matchesPlayerColors,
    coords: matches.object as Validator<unknown, { q: number; r: number; direction: CornerDirection }>,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  endTurn: defineAction({
    type: 'hexafield.catan.GameActions.endTurn',
    player: matchesPlayerColors,
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export const GameState = defineState({
  name: 'hexafield.catan.GameState',
  initial: {
    currentPlayer: '' as PlayerColorsType,
    playerColors: {} as Record<PlayerColorsType, UserID>,
    playerOrder: [] as Array<{ player: PlayerColorsType; roll: number }>,
    currentPhase: 'choose-colors' as PhaseTypes,
    resources: {} as Record<PlayerColorsType, PlayerResources>,
    structures: [] as StructureDataType[]
  },
  receptors: {
    chooseColor: SetupActions.chooseColor.receive((action) => {
      const state = getMutableState(GameState)
      state.playerColors.merge({ [action.color]: action.userID })

      // a little dangerous, but with our design we can assume that PlayerState does not change once the game starts
      if (Object.keys(state.playerColors).length === getState(PlayerState).players.length) {
        state.currentPhase.set('setup-roll')
      }
    }),
    rollForOrder: SetupActions.rollForOrder.receive((action) => {
      const state = getMutableState(GameState)
      state.playerOrder.merge([{ player: action.player, roll: action.roll[0] + action.roll[1] }])
      if (state.playerOrder.length === getState(PlayerState).players.length) {
        // if any players have the same roll, they must re-roll
        const rolls = state.playerOrder.map((order) => order.roll)
        const hasDuplicates = rolls.some((roll) => rolls.filter((r) => r === roll).length > 1)
        if (hasDuplicates) {
          state.currentPhase.set('setup-roll')
          state.playerOrder.set([])
        } else {
          state.playerOrder.set(getState(GameState).playerOrder.sort((a, b) => b.roll - a.roll))
          state.currentPlayer.set(state.playerOrder[0].player.value)
          state.currentPhase.set('setup-first')
        }
      }
    }),
    purchaseItem: GameActions.purchaseItem.receive((action) => {
      const state = getMutableState(GameState)
      const currentPlayerResources = state.resources[action.player]
      for (const resource in action.cost) {
        if (!currentPlayerResources.value[resource]) currentPlayerResources[resource].set(0)
        currentPlayerResources[resource].set((current) => current - action.cost[resource])
      }
    }),
    buildSettlement: GameActions.buildSettlement.receive((action) => {
      const state = getMutableState(GameState)
      state.structures.merge([
        {
          player: action.player,
          type: 'settlement',
          coords: action.coords
        }
      ])
    }),
    buildRoad: GameActions.buildRoad.receive((action) => {
      const state = getMutableState(GameState)
      state.structures.merge([
        {
          player: action.player,
          type: 'road',
          coords: action.coords
        }
      ])

      // setup phase
      if (state.currentPhase.value === 'setup-first') {
        const currentPlayerIndex = state.playerOrder.value.findIndex((order) => order.player === action.player)
        if (currentPlayerIndex === state.playerOrder.value.length - 1) {
          state.currentPhase.set('setup-second')
        } else {
          state.currentPlayer.set(getNextPlayer())
        }
      } else if (state.currentPhase.value === 'setup-second') {
        const currentPlayerIndex = state.playerOrder.value.findIndex((order) => order.player === action.player)
        if (currentPlayerIndex === 0) {
          state.currentPhase.set('roll')
        } else {
          const previousPlayerIndex = currentPlayerIndex - 1
          const previousPlayer = state.playerOrder.value[previousPlayerIndex].player
          state.currentPlayer.set(previousPlayer)
        }
      }
    }),
    rollResources: GameActions.rollResources.receive((action) => {
      const state = getMutableState(GameState)
      for (const resource in action.resources) {
        if (!state.resources.value[action.player]) state.resources.merge({ [action.player]: {} })
        if (!state.resources[action.player].value[resource]) state.resources[action.player].merge({ [resource]: 0 })
        state.resources[action.player][resource].set((c) => c + action.resources[resource])
      }
      /** @todo add trading */
      // state.currentPhase.set('trade')
      state.currentPhase.set('build')
    }),
    doneTrading: GameActions.doneTrading.receive((action) => {
      const state = getMutableState(GameState)
      state.currentPhase.set('build')
    }),
    endTurn: GameActions.endTurn.receive((action) => {
      const state = getMutableState(GameState)
      state.currentPlayer.set(getNextPlayer())
      state.currentPhase.set('roll')
    })
  },

  reactor: () => {
    const state = useMutableState(GameState)

    console.log(structuredClone(state.get(NO_PROXY)))

    useEffect(() => {
      getMutableState(StructureState).structures.set(state.structures.get(NO_PROXY))
    }, [state.structures])

    useEffect(() => {
      if (state.currentPhase.value === 'setup-first' || state.currentPhase.value === 'setup-second') {
        const currentPlayer = getState(GameState).currentPlayer
        const playerStructures = getState(StructureState).structures.filter((s) => s.player === currentPlayer)
        if (playerStructures.length % 2 === 0) {
          getMutableState(StructurePlacementState).active.set(['settlement'])
        } else if (playerStructures.length % 2 === 1) {
          getMutableState(StructurePlacementState).active.set(['road'])
        }
      }
    }, [state.currentPhase.value, state.structures])

    useEffect(() => {
      if (state.currentPhase.value !== 'setup-second') return

      return () => {
        // give resources to players
        // players each get resources for their second settlement
        // since all players have this reactor, we only need to do this for ourselves
        const player = getMyColor()
        const resources = {} as PlayerResources
        const secondStructureForPlayer = state.structures.value.findLast(
          (s) => s.player === player && s.type === 'settlement'
        )!
        const adjacentHexes = getAdjacentHexesToStructure(secondStructureForPlayer)
        const stringCoords = adjacentHexes.filter(_filterNull).map((coords) => `${coords.q},${coords.r}`)
        const entities = stringCoords
          .map((coords) => HexagonGridComponent.coordsToEntity.get(NO_PROXY)[coords])
          .filter((e) => entityExists(e) && hasComponent(e, HexagonGridComponent))
        const hexes = entities.map((entity) => getComponent(entity, HexagonGridComponent))
        for (const hex of hexes) {
          const resource = ResourceByTile[hex.tile]
          if (!resource) continue
          if (!resources[resource]) resources[resource] = 1
          else resources[resource] += 1
        }
        dispatchAction(
          GameActions.rollResources({
            player,
            resources
          })
        )
      }
    }, [state.currentPhase.value])

    const viewerEntity = useMutableState(EngineState).viewerEntity.value

    if (!viewerEntity) return null

    return <DoneButtonReactor />
  }
})

const uiSize = new Vector2()
const uiScale = 0.05

const DoneButtonReactor = () => {
  const xrui = useHookstate(() => {
    const { entity, container } = createXRUI(DoneButtonXRUI)

    setComponent(entity, TransformComponent)
    setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(entity, NameComponent, 'Done Button XRUI')
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
          -0.9,
          -0.9,
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

  const state = useMutableState(GameState).value
  const currentPlayer = isCurrentPlayer(getState(EngineState).userID)
  const isBuildPhase = state.currentPhase === 'build'

  useEffect(() => {
    setVisibleComponent(xrui, currentPlayer && isBuildPhase)
  }, [currentPlayer && isBuildPhase])

  return null
}

const DoneButtonXRUI = () => {
  const gameState = useMutableState(GameState).value
  const currentPlayer = isCurrentPlayer(getState(EngineState).userID)
  const isBuildPhase = gameState.currentPhase === 'build'

  // clicked as a hackfix to prevent double-clicking
  const clicked = useHookstate(false)

  const onClick = () => {
    if (!isBuildPhase || !currentPlayer || clicked.value) return
    clicked.set(true)
    dispatchAction(GameActions.endTurn({ player: getMyColor() }))
  }

  useEffect(() => {
    clicked.set(false)
  }, [isBuildPhase])

  return (
    <div id="container" xr-layer="true">
      <button onClick={onClick}>Done</button>
    </div>
  )
}

const getNextPlayer = () => {
  const state = getState(GameState)
  const currentPlayerIndex = state.playerOrder.findIndex((order) => order.player === state.currentPlayer)
  const nextPlayerIndex = (currentPlayerIndex + 1) % state.playerOrder.length
  return state.playerOrder[nextPlayerIndex].player
}
