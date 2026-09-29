# Port Vesta — Full Game Specification

You are an expert Unreal Engine 5.4+ game developer. Build an original open-world action game that replicates the gameplay mechanics, controls, and feel of GTA V as closely as possible, but with an original city, original characters, and original names (no Rockstar assets, names, or logos). Use C++ for core systems and Blueprints for gameplay tuning. Work one system at a time, test it, then continue. After each step, tell me exactly what to do in the editor.

=== GRAPHICS (HIGHEST QUALITY) ===
- Photorealistic art direction. Enable Nanite on all static geometry, Lumen for global illumination and reflections, Virtual Shadow Maps, hardware ray tracing when available.
- Use Quixel Megascans / Fab assets for surfaces, props, and foliage. MetaHuman for all main characters and pedestrians.
- Volumetric clouds, Sky Atmosphere, dynamic time of day (24h cycle = 48 real minutes, like GTA).
- Weather system: clear, cloudy, rain (wet road reflections, puddles), thunderstorm, fog. Smooth transitions.
- Post-process: film grain (subtle), cinematic color grading, lens flare, bloom, motion blur, depth of field in cutscenes.
- TSR or DLSS upscaling. Graphics settings menu with Low/Medium/High/Ultra/Custom.

=== CITY & WORLD ===
- Original city "Port Vesta" inspired by a sunny West Coast metropolis: downtown towers, Hollywood-style hills with a big sign, beaches with a pier, port, airport, ghettos, rich villas, desert countryside, mountain, and a highway network.
- Use World Partition for streaming the large map without loading screens.
- Interiors: safehouses, shops, clothing stores, barber, tattoo parlor, gun store, mod garage, bars, strip-mall stores that can be robbed.
- Map fog of war is OFF; full map visible like GTA V.

=== PLAYER CONTROLS (same scheme as GTA V, PC + controller) ===
- W/A/S/D move, Shift sprint (tap repeatedly to run faster), Space jump/climb, C crouch/stealth, F enter/exit vehicle, R reload, Q take cover, right mouse aim, left mouse shoot, V change camera (3rd person far/mid/close + 1st person).
- TAB (hold) = WEAPON WHEEL: game slows to slow-motion, radial wheel with 8 slots (Melee, Handguns, SMGs, Shotguns, Assault Rifles, Sniper Rifles, Heavy Weapons, Throwables). Move mouse to select slot; scroll wheel cycles weapons within the slot; release TAB to equip. Show ammo count for each weapon.
- Scroll wheel quick-switches weapons without opening the wheel.
- Up arrow = open phone. M / Esc = pause map.
- Controller: LB hold for weapon wheel, same layout as GTA V.

=== CHARACTERS ===
- 3 playable original protagonists, each with a unique special ability (slow-motion aiming, slow-motion driving, rage mode).
- Character switch: press Alt (hold) to open character wheel; camera zooms up into the sky, travels, and zooms down to the other character (the GTA V switch effect).
- Stats per character: Stamina, Shooting, Strength, Stealth, Flying, Driving, Lung Capacity — improve by doing the activity.
- Health (regenerates to 50%), armor, special ability bar.

=== WEAPONS ===
- 40+ weapons across the 8 categories. Realistic recoil, spread, and sound.
- Attachments: suppressor, scope, extended magazine, flashlight, grip. Weapon tints.
- Gun store with shop UI to buy weapons, ammo, attachments, and body armor.
- Lock-on aiming (optional setting) and free aim.

=== VEHICLES ===
- 100+ original vehicles: sedans, sports cars, supercars, SUVs, muscle cars, motorcycles, trucks, buses, boats, jet skis, helicopters, planes.
- Chaos Vehicle physics tuned to feel arcade-realistic like GTA V.
- Carjacking animation (pull driver out), hotwire parked cars.
- Deformable damage, windows break, tires can be shot, engine smoke and fire, explosion.
- Radio: Q/scroll to switch stations, radio wheel, 8+ stations with original music and DJ talk.
- Mod garage: paint, wheels, engine, brakes, suspension, turbo, armor, bulletproof tires, horns, neon, window tint.
- Personal garage per character. Vehicle calls via phone.
- Cinematic camera button while driving.

=== PHONE ===
- Smartphone with apps: Contacts (call characters, taxi, mechanic), Messages, Email, Internet browser (fake in-game websites and stock market), Camera (selfie mode), Map, Settings, Quick Save.

=== WANTED SYSTEM (exactly like GTA V) ===
- 1 to 5 stars. Crime witnessed = stars. Police search cone visible on minimap.
- Stars flash when out of police sight; stay out of search zone to lose them.
- Response scales: 1–2 stars patrol cars, 3 stars more units + roadblocks, 4 stars SWAT + helicopters, 5 stars military-level response.
- Respray at mod garage while not seen removes stars.
- Death = wake up at hospital, lose some money. Busted = police station.

=== WORLD AI ===
- Pedestrians with schedules, phone calls, conversations, reactions (flee, fight back, film you, call police).
- Traffic AI with lanes, traffic lights, honking, road rage, accidents.
- Gangs in specific neighborhoods that attack if provoked.
- Random events around the map (robberies, car thefts, people needing help).
- Wildlife in the countryside.

=== MISSIONS & HEISTS ===
- Story mission framework: mission markers on map (letters of characters), cutscenes, objectives, checkpoints, gold medal challenges, replay option.
- Heist system: choose approach (loud / stealth), pick crew members with different skills and cut percentages, setup missions, then the big score.
- Side activities: street races, taxi missions, towing, hunting, golf, tennis, darts, parachuting, stunt jumps, collectibles.
- Store robberies with cash register interaction.

=== ECONOMY & CUSTOMIZATION ===
- Money per character. Buy properties that give weekly income.
- Clothing stores with full outfit system, barbers, tattoo parlors.
- Stock market in phone browser affected by mission outcomes.

=== UI / HUD (GTA V style layout) ===
- Bottom-left rounded minimap with health/armor/special bars under it, GPS route line in purple/yellow.
- Top-right: money, weapon icon, ammo count, wanted stars.
- Pause menu tabs: Map, Brief, Stats, Settings, Game (load/save), Gallery.
- Full map with waypoint placement and legend of icons.

=== AUDIO ===
- Positional 3D sound, realistic weapon and engine sounds, ambient city noise that changes by area and time.

=== SAVE SYSTEM ===
- Save at safehouse beds, autosave after missions, quick save from phone.

Start with: project setup, World Partition map template, and the third-person player controller with GTA V control scheme. Then continue in this order: camera, weapon wheel, weapons, vehicles, HUD, wanted system, AI, phone, missions, character switching, customization, graphics polish.
