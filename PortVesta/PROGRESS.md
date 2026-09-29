# Port Vesta — Progress

## Done
- [x] SPEC.md, CLAUDE.md, PROGRESS.md, Git (project lives in the `PortVesta/` folder of this repository)
- [x] Step 1 (code written, NOT yet compiled/tested by the user):
  - `PortVesta.uproject` (UE 5.4, Enhanced Input), Target/Build files, module
  - Config: Lumen GI + reflections, Virtual Shadow Maps, TSR, DX12/SM6, Enhanced Input,
    default map `/Game/Maps/PortVesta`, default game mode `APVGameMode`
  - `APVGameMode` — spawns `APVPlayerCharacter`
  - `APVPlayerCharacter` — third-person player, input built in C++ at runtime (no assets):
    WASD/left stick move, mouse/right stick look, Shift/A sprint (tap repeatedly = faster),
    Space/X jump, C/L3 crouch toggle. Ground-snap on spawn for World Partition streaming.
    Placeholder body (cylinder + nose) until a real character model is added.
  - The map itself must be created by the user in the editor (File > New Level > Open World),
    saved as `Content/Maps/PortVesta`.

## Waiting on user
- Compile + open the project, create the map, test walking. Report errors (screenshot).

## Not yet done from the control scheme (comes in later steps)
- Climbing/vaulting (Space), cover (Q), aim/shoot, reload, weapon wheel (TAB), vehicles (F),
  phone (Up arrow), pause map (M/Esc), camera modes (V — next step), real character model + animations.

## Next step
- [ ] Step 2: Camera (V cycles far/mid/close/1st-person, aim camera over the shoulder)

## Order of systems (from SPEC.md)
1. Project setup, World Partition map, third-person player controller  ← code done, awaiting test
2. Camera
3. Weapon wheel
4. Weapons
5. Vehicles
6. HUD
7. Wanted system
8. AI
9. Phone
10. Missions
11. Character switching
12. Customization
13. Graphics polish
