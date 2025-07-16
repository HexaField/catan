# Catan for XR built on iR Engine

A demo game implementation of the board game Catan for a stripped down iR Engine.

Designed with fun and not security in mind!

## Progress

- [x] Basic hex construction
- [x] Chance indicators and starter game
- [x] Settlements and roads
- [x] P2P Signaling server and client connectivity
- [x] Dice roll, turns and resources
- [x] Placement of structures
- [x] Turn Done & Resources UI
- [x] Purchase structures UI
- [x] Dice Roll UI
- [x] Last rolled UI
- [x] Player Ready & Colour selection UI
- [ ] Resource Trading UI
- [ ] City upgrades
- [ ] Robber
- [ ] Harbours
- [ ] Development cards
- [ ] Room selection that persists in URL search params
- [ ] Mobile friendly UI
- [ ] VR mode
- [ ] AR tabletop mode
- [ ] Expansion packs!

## Resources Used

- https://www.printables.com/model/73257-settlers-of-catan-upgrade/files
- https://www.redblobgames.com/grids/hexagons/
- https://github.com/kriscamilleri/open-catan
- https://github.com/BryantCabrera/Settlers-of-Catan/

## Setup

```bash
npm run clone-project -- --url https://github.com/hexafield/catan
npm run clone-project -- --url https://github.com/hexafield/ir-simple-api
npm i
cd packages/projects/projects/hexafield/catan
cp .env.local.default .env.local
npm run dev
```