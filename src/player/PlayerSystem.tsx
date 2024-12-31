import { InputSystemGroup, PresentationSystemGroup, defineSystem } from '@ir-engine/ecs'
import {
  UserID,
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { NetworkState, NetworkTopics, matchesUserID } from '@ir-engine/network'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import React, { useEffect } from 'react'

export const PlayerColors = ['red', 'blue', 'white', 'orange'] as const
export type PlayerColorsType = (typeof PlayerColors)[number]

export const PlayerSystem = defineSystem({
  uuid: 'hexafield.catan.PlayerSystem',
  insert: { with: InputSystemGroup },
  execute: () => {
    const viewerEntity = getState(EngineState).viewerEntity
    if (!viewerEntity) return

    const playerState = getState(PlayerState)
    if (playerState.playersReady) return

    const playersCount = playerState.players.length
    if (playersCount < 2) return

    const buttons = InputComponent.getMergedButtons(viewerEntity)

    // will be replaced with UI eventually
    if (buttons.KeyK?.down) {
      dispatchAction(PlayerActions.playersReady({}))
    }
  },
  reactor: () => {
    const worldNetworkready = useHookstate(NetworkState.worldNetworkState)?.ready?.value
    const playersReady = useMutableState(PlayerState).playersReady.value

    // if a game is already in progress, don't allow new players to join
    if (!worldNetworkready || playersReady) return null

    return (
      <>
        <JoinGameReactor />
      </>
    )
  }
})

const JoinGameReactor = () => {
  useEffect(() => {
    dispatchAction(PlayerActions.playerJoin({ userID: getState(EngineState).userID }))
  }, [])

  return null
}

export const PlayerActions = {
  playerJoin: defineAction({
    type: 'hexafield.catan.PlayerActions.joinGame',
    userID: matchesUserID,
    $cache: true,
    $topic: NetworkTopics.world
  }),
  playersReady: defineAction({
    type: 'hexafield.catan.PlayerActions.playersReady',
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export const PlayerState = defineState({
  name: 'hexafield.catan.PlayerState',
  initial: {
    playersReady: false,
    players: [] as Array<UserID>
  },

  receptors: {
    joinGame: PlayerActions.playerJoin.receive((action) => {
      getMutableState(PlayerState).players.merge([action.userID])
    }),
    playersReady: PlayerActions.playersReady.receive(() => {
      getMutableState(PlayerState).playersReady.set(true)
    })
  }
})
