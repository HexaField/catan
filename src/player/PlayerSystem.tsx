import { InputSystemGroup, defineSystem, getComponent } from '@ir-engine/ecs'
import { NO_PROXY, UserID, defineState, getState } from '@ir-engine/hyperflux'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { HexagonGridComponent, ResourceByTile, Resources } from '../hexes/HexagonGridSystem'
import { getAdjacentHexesToStructure } from '../structures/StructureFunctions'
import { StructureState } from '../structures/StructureSystem'

const rollDice = () => {
  return Math.floor(Math.random() * 6) + 1
}

const onMakeTurn = () => {
  const dieRoll = [rollDice(), rollDice()]

  const currentPlayer = 'red' // todo

  const combined = dieRoll.reduce((a, b) => a + b, 0)

  const newResources = {} as Record<string, number>

  const playerStructures = getState(StructureState)
    .structures.filter((s) => s.player === currentPlayer)
    .filter((s) => s.type === 'settlement' || s.type === 'city')

  for (const structure of playerStructures) {
    const adjacentHexes = getAdjacentHexesToStructure(structure) as { q: number; r: number }[]
    const stringCoords = adjacentHexes.map((coords) => `${coords.q},${coords.r}`)
    const entities = stringCoords.map((coords) => HexagonGridComponent.coordsToEntity.get(NO_PROXY)[coords])
    const hexes = entities.map((entity) => getComponent(entity, HexagonGridComponent))
    const hexesHitThisTurn = hexes.filter((hex) => hex.chance === combined)
    for (const hex of hexesHitThisTurn) {
      const resource = ResourceByTile[hex.tile]
      if (!resource) continue
      if (!newResources[resource]) newResources[resource] = structure.type === 'settlement' ? 1 : 2
      else newResources[resource] += structure.type === 'settlement' ? 1 : 2
    }
  }

  console.log({ dieRoll, combined }, newResources)
}

export const PlayerSystem = defineSystem({
  uuid: 'hexafield.catan.PlayerSystem',
  insert: { with: InputSystemGroup },
  execute: () => {
    const viewerEntity = getState(EngineState).viewerEntity
    if (!viewerEntity) return

    const buttons = InputComponent.getMergedButtons(viewerEntity)

    // will be replaced with UI eventually
    if (buttons.KeyK?.down) onMakeTurn()
  },
  reactor: () => {
    return null
  }
})

export const PlayerState = defineState({
  name: 'hexafield.catan.PlayerState',
  initial: {
    currentPlayer: 'red',
    players: {} as Record<
      string /** colour */,
      {
        resources: Record<keyof typeof Resources, number>
        userID: UserID
      }
    >
  }
})
