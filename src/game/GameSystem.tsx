import {
  EntityTreeComponent,
  InputSystemGroup,
  SourceID,
  UUIDComponent,
  defineSystem,
  entityExists,
  getComponent,
  hasComponent,
  removeComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { EngineState } from '@ir-engine/ecs/src/EngineState'
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
import { NetworkTopics, matchesUserID } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { ReferenceSpaceState } from '@ir-engine/spatial/src/ReferenceSpaceState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { VisibleComponent, setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import { Vector2 } from 'three'
import { HexagonGridComponent, ResourceByTile, ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors, PlayerColorsType, PlayerState } from '../player/PlayerSystem'
import { getAdjacentHexesToStructure } from '../structures/StructureFunctions'
import { StructureHelperComponent, StructurePlacementState } from '../structures/StructurePlacementSystem'
import { CornerDirection, EdgeDirection, StructureDataType, StructureState } from '../structures/StructureSystem'

const _filterNull = <T extends any>(x: T | null): x is T => x !== null

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

export const GameSystem = defineSystem({
  uuid: 'hexafield.catan.GameSystem',
  insert: { with: InputSystemGroup },
  execute: () => {
    const viewerEntity = getState(ReferenceSpaceState).viewerEntity
    if (!viewerEntity) return

    const playersReady = getState(PlayerState).playersReady
    if (!playersReady) return

    const buttons = InputComponent.getMergedButtons(viewerEntity)

    const currentPhase = getState(GameState).currentPhase

    if (!isCurrentPlayer(getState(EngineState).userID)) return

    if (currentPhase === 'setup-first' || currentPhase === 'setup-second' || currentPhase === 'build') {
      if (buttons.PrimaryClick?.up) placeStructure()
      return
    }
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

const matchesPlayerColors = matches.literals('red', 'blue', 'white', 'orange')
const matchesResources = matches.object as Validator<unknown, PlayerResources>
const matchesPlayerResources = matches.object as Validator<unknown, Record<PlayerColorsType, PlayerResources>>

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
  }),
  firstResources: defineAction({
    type: 'hexafield.catan.SetupActions.firstResources',
    player: matchesPlayerColors,
    resources: matchesResources,
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export const GameActions = {
  rollResources: defineAction({
    type: 'hexafield.catan.GameActions.rollDice',
    roll: matches.arrayOf(matches.number),
    playerResources: matchesPlayerResources,
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
    playerOrder: [] as Array<{ player: PlayerColorsType; roll: number[] }>,
    lastRoll: {} as { roll: number[]; player: PlayerColorsType },
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
      state.playerOrder.merge([{ player: action.player, roll: action.roll }])
      if (state.playerOrder.length === getState(PlayerState).players.length) {
        // if any players have the same roll, they must re-roll
        const rolls = state.playerOrder.map((order) => order.roll)
        const hasDuplicates = rolls.some((roll) => rolls.filter((r) => r === roll).length > 1)
        if (hasDuplicates) {
          state.currentPhase.set('setup-roll')
          state.playerOrder.set([])
        } else {
          state.playerOrder.set(
            getState(GameState).playerOrder.sort((a, b) => b.roll[0] + b.roll[1] - (a.roll[0] + a.roll[1]))
          )
          state.currentPlayer.set(state.playerOrder[0].player.value)
          state.currentPhase.set('setup-first')
        }
      }
    }),
    firstResources: SetupActions.firstResources.receive((action) => {
      const state = getMutableState(GameState)
      for (const resource in action.resources) {
        if (!state.resources.value[action.player]) state.resources.merge({ [action.player]: {} })
        if (!state.resources[action.player].value[resource]) state.resources[action.player].merge({ [resource]: 0 })
        state.resources[action.player][resource].set((c) => c + action.resources[resource])
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
      for (const player in action.playerResources) {
        const playerResources = action.playerResources[player]
        for (const resource in playerResources) {
          if (!state.resources.value[player]) state.resources.merge({ [player]: {} })
          if (!state.resources[player].value[resource]) state.resources[player].merge({ [resource]: 0 })
          state.resources[player][resource].set((c) => c + playerResources[resource])
        }
      }
      state.lastRoll.set({
        roll: action.roll,
        player: state.currentPlayer.value
      })
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
      if (state.currentPhase.value !== 'setup-first' && state.currentPhase.value !== 'setup-second') return

      const currentPlayer = getState(GameState).currentPlayer
      if (currentPlayer !== getMyColor()) return

      const playerStructures = getState(StructureState).structures.filter((s) => s.player === currentPlayer)
      if (playerStructures.length % 2 === 0) {
        getMutableState(StructurePlacementState).active.set(['settlement'])
      } else if (playerStructures.length % 2 === 1) {
        getMutableState(StructurePlacementState).active.set(['road'])
      }
    }, [state.currentPhase.value, state.structures])

    useEffect(() => {
      if (state.currentPhase.value !== 'setup-second') return

      return () => {
        // once all players have placed their second settlement, we need to give resources to players
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
          SetupActions.firstResources({
            player,
            resources
          })
        )
      }
    }, [state.currentPhase.value])

    const viewerEntity = useMutableState(ReferenceSpaceState).viewerEntity.value

    if (!viewerEntity) return null

    return <DoneButtonReactor />
  }
})

const uiSize = new Vector2()
const uiScale = 0.25

const DoneButtonReactor = () => {
  const chooseColorXRUI = useHookstate(() => {
    const { entity, container } = createXRUI(ChooseColorXRUI)

    setComponent(entity, TransformComponent)
    setComponent(entity, UUIDComponent, {
      entitySourceID: 'catan-ui' as SourceID,
      entityID: UUIDComponent.generate()
    })
    setComponent(entity, NameComponent, 'Done Button XRUI')
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(ReferenceSpaceState).originEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [getState(ReferenceSpaceState).viewerEntity],
      computeFunction: () => {
        const camera = getComponent(getState(ReferenceSpaceState).viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        const uiContainer = container.rootLayer.querySelector('#container')
        if (!uiContainer) return
        uiSize.set(uiContainer.domSize.x, uiContainer.domSize.y)
        ObjectFitFunctions.snapToSideOfScreen(
          entity,
          uiSize,
          uiScale,
          distance,
          'center',
          'center',
          getState(ReferenceSpaceState).viewerEntity
        )
      }
    })
    removeComponent(entity, VisibleComponent)

    return entity
  }).value

  useEffect(() => {
    return () => {
      removeEntity(chooseColorXRUI)
    }
  }, [])

  const state = useMutableState(GameState).value
  const chosenColor = !!getMyColor()
  const isBuildPhase = state.currentPhase === 'choose-colors'

  useEffect(() => {
    setVisibleComponent(chooseColorXRUI, !chosenColor && isBuildPhase)
  }, [chosenColor, isBuildPhase])

  return null
}

const ChooseColorXRUI = () => {
  const gameState = useMutableState(GameState).value
  const myColorChosen = !!getMyColor()

  // clicked as a hackfix to prevent double-clicking
  const clicked = useHookstate(false)

  const onClick = (color: PlayerColorsType) => {
    if (myColorChosen || !!gameState.playerColors[color] || clicked.value) return
    clicked.set(true)
    dispatchAction(SetupActions.chooseColor({ color, userID: getState(EngineState).userID }))
  }

  useEffect(() => {
    clicked.set(false)
  }, [gameState])

  return (
    <div id="container" xr-layer="true">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          width: '100%',
          height: '100%'
        }}
      >
        {PlayerColors.map((color) => (
          <button
            key={color}
            onClick={() => onClick(color)}
            style={{
              backgroundColor: myColorChosen || !!gameState.playerColors[color] ? colorDarkerVariants[color] : color
            }}
          >
            {gameState.playerColors[color] ? 'Taken' : 'Choose'}
          </button>
        ))}
      </div>
    </div>
  )
}

const colorDarkerVariants = {
  red: '#AA3333',
  blue: '#3333AA',
  white: '#AAAAAA',
  orange: '#AAA733'
}

const getNextPlayer = () => {
  const state = getState(GameState)
  const currentPlayerIndex = state.playerOrder.findIndex((order) => order.player === state.currentPlayer)
  const nextPlayerIndex = (currentPlayerIndex + 1) % state.playerOrder.length
  return state.playerOrder[nextPlayerIndex].player
}
