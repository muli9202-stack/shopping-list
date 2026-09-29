#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "PVGameMode.generated.h"

/** Main game mode: spawns the player as APVPlayerCharacter. */
UCLASS()
class PORTVESTA_API APVGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	APVGameMode();
};
