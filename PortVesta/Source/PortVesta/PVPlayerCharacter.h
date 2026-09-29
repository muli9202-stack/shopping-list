#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PVPlayerCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

/**
 * Third-person on-foot player with the GTA-style control scheme.
 * Input actions and key mappings are built in C++ at runtime (no assets needed).
 *
 * Keyboard/mouse: WASD move, Shift sprint (tap repeatedly to run faster), Space jump, C crouch, mouse look.
 * Controller:     Left stick move, right stick look, A sprint (tap), X jump, L3 crouch.
 */
UCLASS()
class PORTVESTA_API APVPlayerCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	APVPlayerCharacter();

	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void Restart() override;
	virtual void OnStartCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust) override;
	virtual void OnEndCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust) override;

protected:
	// ---- Tuning (editable in the editor, Details panel) ----

	/** Normal on-foot speed (GTA default is a jog). */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float JogSpeed = 400.f;

	/** Sprint speed when holding / tapping sprint once. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float SprintSpeed = 620.f;

	/** Top sprint speed reached by tapping sprint repeatedly. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float MaxSprintSpeed = 780.f;

	/** Boost (0..1) added per fast sprint tap. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0", ClampMax = "1"))
	float SprintTapBoost = 0.25f;

	/** How fast the tap boost fades, per second. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float SprintBoostDecay = 0.5f;

	/** Seconds between taps that still count as "tapping" (also keeps a tap-sprint alive). */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float SprintTapWindow = 0.6f;

	/** Speed while crouched / stealth. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float CrouchSpeed = 180.f;

	/** How quickly speed blends between jog and sprint. */
	UPROPERTY(EditAnywhere, Category = "Port Vesta|Movement", meta = (ClampMin = "0"))
	float SpeedChangeRate = 5.f;

	UPROPERTY(EditAnywhere, Category = "Port Vesta|Camera", meta = (ClampMin = "0"))
	float MouseSensitivity = 1.f;

	UPROPERTY(EditAnywhere, Category = "Port Vesta|Camera", meta = (ClampMin = "0"))
	float GamepadLookSensitivity = 60.f;

	// ---- Components ----

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<UCameraComponent> FollowCamera;

	/** Temporary body shape until a real character model is added. */
	UPROPERTY(VisibleAnywhere, Category = "Placeholder")
	TObjectPtr<UStaticMeshComponent> PlaceholderBody;

	/** Small block on the front of the placeholder so you can see which way it faces. */
	UPROPERTY(VisibleAnywhere, Category = "Placeholder")
	TObjectPtr<UStaticMeshComponent> PlaceholderNose;

private:
	void BuildInputMappings();

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void LookGamepad(const FInputActionValue& Value);
	void SprintPressed();
	void SprintReleased();
	void JumpPressed();
	void JumpReleased();
	void ToggleCrouch();

	/** Waits for streamed-in ground under the player, then drops them onto it. */
	void TrySnapToGround();
	void FinishGroundSnap();

	void UpdatePlaceholderBody();

	UPROPERTY(Transient)
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> LookGamepadAction;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> SprintAction;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> JumpAction;

	UPROPERTY(Transient)
	TObjectPtr<UInputAction> CrouchAction;

	bool bSprintHeld = false;
	float SprintBoost = 0.f;
	float LastSprintTapTime = -1000.f;

	FTimerHandle GroundSnapTimer;
	float GroundSnapElapsed = 0.f;
};
