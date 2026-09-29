#include "PVGameMode.h"
#include "PVPlayerCharacter.h"

APVGameMode::APVGameMode()
{
	DefaultPawnClass = APVPlayerCharacter::StaticClass();
}
