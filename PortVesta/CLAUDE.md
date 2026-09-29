# Port Vesta — Project Rules

Full game spec: see `SPEC.md`. Progress log: see `PROGRESS.md` (update it after every step).

## Communication
- ALWAYS talk to the user in Hebrew only, in simple words. The user does not understand English.
- The user wants minimal involvement. Only ask for what is truly necessary.
- Before starting any new system: explain the plan in Hebrew and WAIT until the user writes "מאשר".
- When the user must do something inside Unreal Editor, give exact click-by-click steps in Hebrew
  (menu names may stay in English, since the editor is in English — explain where each one is).

## Code
- Write everything in C++. Do NOT use Blueprints for logic (overrides the SPEC line about Blueprints).
  Tunable values are exposed as UPROPERTY(EditAnywhere) so they can be adjusted in the editor without code.
- Engine: Unreal Engine 5.4+. Use Enhanced Input, Chaos Vehicles, World Partition.
- Original names/assets only — no Rockstar names, logos, or assets.

## Workflow
- Work on ONE system at a time, in the order listed at the end of SPEC.md.
- The project must compile after every change. Claude works in a cloud container without Unreal Engine,
  so it cannot compile itself: write code carefully (correct includes, module dependencies in Build.cs,
  UE 5.4 APIs), and ask the user to compile and report errors after each step.
- Commit after each completed step with a clear message.
