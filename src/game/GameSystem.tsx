import { InputSystemGroup, defineSystem, entityExists, getComponent, hasComponent } from '@ir-engine/ecs'
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
  useMutableState
} from '@ir-engine/hyperflux'
import { NetworkTopics, matchesUserID } from '@ir-engine/network'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { useEffect } from 'react'
import { HexagonGridComponent, ResourceByTile, ResourceType } from '../hexes/HexagonGridSystem'
import { PlayerColors, PlayerColorsType, PlayerState } from '../player/PlayerSystem'
import {
  getAdjacentHexesToStructure,
  getRandomCornerCoords,
  getRandomEdgeCoords
} from '../structures/StructureFunctions'
import { CornerDirection, EdgeDirection, StructureDataType, StructureState } from '../structures/StructureSystem'

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
  dispatchAction(SetupActions.rollForOrder({ player: selfPlayer, roll }))
}

const setupBuild = () => {
  const currentPlayer = getState(GameState).currentPlayer
  const playerStructures = getState(StructureState).structures.filter((s) => s.player === currentPlayer)
  if (playerStructures.length % 2 === 0) {
    // place settlement
    const randomCoords = getRandomCornerCoords()
    dispatchAction(
      GameActions.buildSettlement({
        player: currentPlayer,
        coords: randomCoords
      })
    )
  } else if (playerStructures.length % 2 === 1) {
    // place road
    const randomCoords = getRandomEdgeCoords()
    dispatchAction(
      GameActions.buildRoad({
        player: currentPlayer,
        coords: randomCoords
      })
    )
  }
}

const rollDice = () => {
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

    if (currentPhase === 'setup-first' || currentPhase === 'setup-second') {
      if (buttons.KeyK?.down) setupBuild()
      return
    }

    if (currentPhase === 'roll') {
      if (buttons.KeyK?.down) rollDice()
      return
    }

    if (currentPhase === 'trade') {
      // todo
      dispatchAction(GameActions.doneTrading({ player: getMyColor() }))
      return
    }

    if (currentPhase === 'build') {
      // todo
      dispatchAction(GameActions.endTurn({ player: getMyColor() }))
      return
    }
  }
})

const isCurrentPlayer = (userID: UserID) => {
  return getState(GameState).playerColors[getState(GameState).currentPlayer] === userID
}
const getMyColor = () => {
  const userID = getState(EngineState).userID
  const playerColors = getState(GameState).playerColors
  return PlayerColors.find((color) => playerColors[color] === userID)!
}

const Phases = ['choose-colors', 'setup-roll', 'setup-first', 'setup-second', 'roll', 'trade', 'build'] as const
export type PhaseTypes = (typeof Phases)[number]

type PlayerResources = Record<ResourceType, number>

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
          // a little dangerous, but with our design we can assume that the board does not change once the game starts
          for (const player of state.playerOrder.value.map((order) => order.player)) {
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
            state.resources.merge({ [player]: resources })
          }
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
        if (!state.resources[action.player][resource].value) state.resources[action.player][resource].set(0)
        state.resources[action.player][resource].set((c) => c + action.resources[resource])
      }
      state.currentPhase.set('trade')
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

    return null
  }
})

const getNextPlayer = () => {
  const state = getState(GameState)
  const currentPlayerIndex = state.playerOrder.findIndex((order) => order.player === state.currentPlayer)
  const nextPlayerIndex = (currentPlayerIndex + 1) % state.playerOrder.length
  return state.playerOrder[nextPlayerIndex].player
}
