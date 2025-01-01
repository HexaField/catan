import {
  Entity,
  PresentationSystemGroup,
  QueryReactor,
  S,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineComponent,
  defineSystem,
  getComponent,
  getMutableComponent,
  removeEntity,
  setComponent,
  useComponent,
  useEntityContext
} from '@ir-engine/ecs'
import { useTexture } from '@ir-engine/engine/src/assets/functions/resourceLoaderHooks'
import { TextComponent } from '@ir-engine/engine/src/scene/components/TextComponent'
import { hookstate, none, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { AmbientLightComponent, DirectionalLightComponent, TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { RendererComponent } from '@ir-engine/spatial/src/renderer/WebGLRendererSystem'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { SceneComponent } from '@ir-engine/spatial/src/renderer/components/SceneComponents'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3
} from 'three'
import { hexHeight, hexRadius, hexWidth } from './HexagonGridConstants'
import { axialToPixel } from './HexagonGridFunctions'

export const Tiles = {
  Hills: 'Hills',
  Forest: 'Forest',
  Mountains: 'Mountains',
  Fields: 'Fields',
  Pasture: 'Pasture',
  Desert: 'Desert'
} as const

export const Resources = {
  Brick: 'Brick',
  Lumber: 'Lumber',
  Ore: 'Ore',
  Grain: 'Grain',
  Wool: 'Wool'
} as const

export type ResourceType = keyof typeof Resources

export const ResourceByTile = {
  Hills: Resources.Brick,
  Forest: Resources.Lumber,
  Mountains: Resources.Ore,
  Fields: Resources.Grain,
  Pasture: Resources.Wool
} as const

const ChanceToDots = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1
} as const

type GridStorage = {
  q: number
  r: number
  tile: keyof typeof Tiles
  chance: 2 | 3 | 4 | 5 | 6 | 0 | 8 | 9 | 10 | 11 | 12
}

const StarterGame: GridStorage[] = [
  { q: 0, r: 0, tile: 'Desert', chance: 0 },
  { q: 1, r: -1, tile: 'Pasture', chance: 4 },
  { q: 1, r: 0, tile: 'Forest', chance: 3 },
  { q: 0, r: 1, tile: 'Fields', chance: 4 },
  { q: -1, r: 1, tile: 'Mountains', chance: 3 },
  { q: -1, r: 0, tile: 'Forest', chance: 11 },
  { q: 0, r: -1, tile: 'Hills', chance: 6 },
  { q: 2, r: -2, tile: 'Forest', chance: 9 },
  { q: 2, r: -1, tile: 'Hills', chance: 10 },
  { q: 2, r: 0, tile: 'Mountains', chance: 8 },
  { q: 1, r: 1, tile: 'Pasture', chance: 5 },
  { q: 0, r: 2, tile: 'Pasture', chance: 11 },
  { q: -1, r: 2, tile: 'Fields', chance: 6 },
  { q: -2, r: 2, tile: 'Hills', chance: 5 },
  { q: -2, r: 1, tile: 'Forest', chance: 8 },
  { q: -2, r: 0, tile: 'Fields', chance: 9 },
  { q: -1, r: -1, tile: 'Fields', chance: 12 },
  { q: 0, r: -2, tile: 'Mountains', chance: 10 },
  { q: 1, r: -2, tile: 'Pasture', chance: 2 }
]

export const HexagonGridComponent = defineComponent({
  name: 'HexagonGridComponent',

  schema: S.Object({
    coords: S.Object({
      q: S.Number(),
      r: S.Number()
    }),
    tile: S.String(),
    chance: S.Number() // 2-12
  }),

  coordsToEntity: hookstate({} as Record<string, Entity>),

  reactor: () => {
    const entity = useEntityContext()
    const coords = useComponent(entity, HexagonGridComponent).coords.value

    useEffect(() => {
      const str = `${coords.q},${coords.r}`
      HexagonGridComponent.coordsToEntity[str].set(entity)
      return () => {
        HexagonGridComponent.coordsToEntity[str].set(none)
      }
    }, [coords.q, coords.r])

    return null
  }
})

export const GridSystem = defineSystem({
  uuid: 'hexafield.catan.HexagonGridSystem',
  insert: { after: PresentationSystemGroup },
  execute: () => {
    //
  },
  reactor: function () {
    const { viewerEntity, originEntity } = useMutableState(EngineState).value
    const sceneEntity = useHookstate(UndefinedEntity)

    useEffect(() => {
      if (!originEntity || !viewerEntity) return

      const entity = createEntity()
      setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(entity, NameComponent, 'Catan Scene')
      setComponent(entity, TransformComponent)
      setComponent(entity, EntityTreeComponent, { parentEntity: originEntity })
      setComponent(entity, VisibleComponent)
      setComponent(entity, SceneComponent)
      sceneEntity.set(entity)

      const directionalLightEntity = createEntity()
      setComponent(directionalLightEntity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(directionalLightEntity, NameComponent, 'Directional Light')
      setComponent(directionalLightEntity, TransformComponent, {
        rotation: new Quaternion().setFromEuler(new Euler(2, 5, 3))
      })
      setComponent(directionalLightEntity, EntityTreeComponent, { parentEntity: originEntity })
      setComponent(directionalLightEntity, VisibleComponent, true)
      setComponent(directionalLightEntity, DirectionalLightComponent, { color: new Color('white'), intensity: 0.5 })

      const ambientLightEntity = createEntity()
      setComponent(ambientLightEntity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(ambientLightEntity, NameComponent, 'Ambient Light')
      setComponent(ambientLightEntity, TransformComponent)
      setComponent(ambientLightEntity, EntityTreeComponent, { parentEntity: originEntity })
      setComponent(ambientLightEntity, VisibleComponent, true)
      setComponent(ambientLightEntity, AmbientLightComponent, { color: new Color('white'), intensity: 1 })

      getMutableComponent(viewerEntity, RendererComponent).scenes.merge([entity])

      return () => {
        sceneEntity.set(UndefinedEntity)
        removeEntity(sceneEntity.value)
        removeEntity(directionalLightEntity)
        removeEntity(ambientLightEntity)
      }
    }, [originEntity, viewerEntity])

    return (
      <>
        {sceneEntity.value ? <GridBuilderReactor parentEntity={sceneEntity.value} /> : null}
        <QueryReactor Components={[HexagonGridComponent]} ChildEntityReactor={HexagonGridLoader} />
      </>
    )
  }
})

const HexagonGridLoader = () => {
  const entity = useEntityContext()

  const { coords, tile, chance } = useComponent(entity, HexagonGridComponent).value
  const [texture] = useTexture(`/${tile}.png`, entity)

  useEffect(() => {
    if (texture) texture.colorSpace = SRGBColorSpace
    const material = getComponent(entity, MeshComponent).material as MeshBasicMaterial
    material.map = texture
  }, [texture])

  if (chance === 0) return null

  const chanceBackgroundEntity = useHookstate(() => {
    const chanceBackgroundEntity = createEntity()
    setComponent(chanceBackgroundEntity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(chanceBackgroundEntity, NameComponent, getComponent(entity, NameComponent) + ' Chance')
    setComponent(chanceBackgroundEntity, TransformComponent, {
      position: new Vector3(0, 0.1, 0),
      scale: new Vector3(0.4, 0.4, 0.4)
    })
    setComponent(chanceBackgroundEntity, EntityTreeComponent, { parentEntity: entity })
    setComponent(chanceBackgroundEntity, VisibleComponent)
    setComponent(
      chanceBackgroundEntity,
      MeshComponent,
      new Mesh(new CircleGeometry().rotateX(Math.PI / 2), new MeshBasicMaterial({ side: DoubleSide, color: 'white' }))
    )
    addObjectToGroup(chanceBackgroundEntity, getComponent(chanceBackgroundEntity, MeshComponent))

    return chanceBackgroundEntity
  }).value

  const chanceTextEntity = useHookstate(() => {
    const chanceTextEntity = createEntity()
    setComponent(chanceTextEntity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(chanceTextEntity, NameComponent, getComponent(entity, NameComponent) + ' Chance Text')
    setComponent(chanceTextEntity, TransformComponent, {
      position: new Vector3(0, 0.15, 0),
      rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
      scale: new Vector3().setScalar(ChanceToDots[chance] * 0.5)
    })
    setComponent(chanceTextEntity, EntityTreeComponent, { parentEntity: entity })
    setComponent(chanceTextEntity, VisibleComponent)
    setComponent(chanceTextEntity, TextComponent, {
      // text: `${coords.q},${coords.r}`,
      text: chance.toString(),
      textAlign: 'center',
      textAnchor: new Vector2(50, 50),
      fontColor: chance === 6 || chance === 8 ? 'red' : 'black'
    })

    return chanceTextEntity
  }).value

  const dotsEntity = useHookstate(() => {
    const dotsEntity = createEntity()
    setComponent(dotsEntity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(dotsEntity, NameComponent, getComponent(entity, NameComponent) + ' Dots')
    setComponent(dotsEntity, TransformComponent, {
      position: new Vector3(0, 0.15, 0.125 + ChanceToDots[chance] * 0.03),
      scale: new Vector3(0.25, 0.25, 0.25)
    })
    setComponent(dotsEntity, EntityTreeComponent, { parentEntity: entity })
    setComponent(dotsEntity, VisibleComponent)

    const circleGeom = new CircleGeometry(0.08, 12).rotateX(Math.PI / 2)
    const geometry = mergeBufferGeometries(
      new Array(ChanceToDots[chance]).fill(0).map((_, i) => circleGeom.clone().translate(0.2 * i, 0, 0))
    )!
    geometry.translate(ChanceToDots[chance] * -0.1 + 0.1, 0, 0)

    setComponent(
      dotsEntity,
      MeshComponent,
      new Mesh(
        geometry,
        new MeshBasicMaterial({ side: DoubleSide, color: chance === 6 || chance === 8 ? 'red' : 'black' })
      )
    )
    addObjectToGroup(dotsEntity, getComponent(dotsEntity, MeshComponent))

    return dotsEntity
  }).value

  useEffect(() => {
    return () => {
      removeEntity(chanceBackgroundEntity)
      removeEntity(chanceTextEntity)
      removeEntity(dotsEntity)
    }
  }, [])

  return null
}

const hexGeom = new BufferGeometry()
// single hexagon outline base on consts defined above, along xz plane
// prettier-ignore
export const vertices = [
  0, 0, 0, // center
  0, 0, hexHeight / 2, // top
  hexWidth / 2, 0, hexHeight / 4, // top right
  hexWidth / 2, 0, -hexHeight / 4, // bottom right
  0, 0, -hexHeight / 2, // bottom
  -hexWidth / 2, 0, -hexHeight / 4, // bottom left
  -hexWidth / 2, 0, hexHeight / 4, // top left
]
const indices = [1, 0, 2, 2, 0, 3, 3, 0, 4, 4, 0, 5, 5, 0, 6, 6, 0, 1]

hexGeom.setIndex(indices)
hexGeom.setAttribute('position', new Float32BufferAttribute(vertices, 3))
hexGeom.computeVertexNormals()
// UVs to allow simple texturing
hexGeom.setAttribute(
  'uv',
  new Float32BufferAttribute([0.5, 0.5, 0.5, 1, 1, 0.75, 1, 0.25, 0.5, 0, 0, 0.25, 0, 0.75], 2)
)

const GridBuilderReactor = (props: { parentEntity: Entity }) => {
  const { parentEntity } = props

  useEffect(() => {
    // const gridCoords = createSpiralGrid({ q: 0, r: 0 }, 3)
    // const randomGrid = gridCoords.map((coord) => {
    //   return {
    //     ...coord,
    //     tile: Object.values(Tiles)[Math.floor(Math.random() * 6)],
    //     chance: Math.floor(Math.random() * 11) + 2
    //   } as GridStorage
    // })
    const starterGrid = StarterGame
    const grid = starterGrid.map(({ q, r, tile, chance }, i) => {
      const { x, z } = axialToPixel({ q, r }, hexWidth, hexRadius)

      const entity = createEntity()
      setComponent(entity, UUIDComponent, UUIDComponent.generateUUID())
      setComponent(entity, NameComponent, `Hexagon ${i}`)
      setComponent(entity, TransformComponent, {
        position: new Vector3(x, 0, z),
        scale: new Vector3(hexRadius, hexRadius, hexRadius)
      })
      setComponent(entity, EntityTreeComponent, { parentEntity })
      setComponent(entity, VisibleComponent)

      setComponent(
        entity,
        MeshComponent,
        new Mesh(hexGeom, new MeshBasicMaterial({ side: DoubleSide, transparent: true, opacity: 1 }))
      )
      addObjectToGroup(entity, getComponent(entity, MeshComponent))

      setComponent(entity, HexagonGridComponent, { coords: { q, r }, tile, chance })

      return entity
    })

    return () => {
      grid.forEach((entity) => {
        removeEntity(entity)
      })
    }
  }, [parentEntity])

  return null
}
