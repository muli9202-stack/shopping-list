#include "PVPlayerCharacter.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr float GroundSnapInterval = 0.1f;
	constexpr float GroundSnapTimeout = 15.f;
}

APVPlayerCharacter::APVPlayerCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	GetCapsuleComponent()->InitCapsuleSize(34.f, 88.f);

	// Character faces where it moves; the camera is steered by the mouse / right stick.
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	MoveComp->bOrientRotationToMovement = true;
	MoveComp->RotationRate = FRotator(0.f, 540.f, 0.f);
	MoveComp->MaxWalkSpeed = JogSpeed;
	MoveComp->MaxWalkSpeedCrouched = CrouchSpeed;
	MoveComp->MinAnalogWalkSpeed = 20.f;
	MoveComp->JumpZVelocity = 450.f;
	MoveComp->AirControl = 0.25f;
	MoveComp->GroundFriction = 8.f;
	MoveComp->BrakingDecelerationWalking = 1600.f;
	MoveComp->GetNavAgentPropertiesRef().bCanCrouch = true;
	MoveComp->bCanWalkOffLedgesWhenCrouching = true;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->SetRelativeLocation(FVector(0.f, 0.f, 40.f));
	CameraBoom->TargetArmLength = 350.f;
	CameraBoom->SocketOffset = FVector(0.f, 0.f, 20.f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 12.f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));

	PlaceholderBody = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlaceholderBody"));
	PlaceholderBody->SetupAttachment(GetCapsuleComponent());
	PlaceholderBody->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PlaceholderBody->SetCanEverAffectNavigation(false);
	if (CylinderMesh.Succeeded())
	{
		PlaceholderBody->SetStaticMesh(CylinderMesh.Object);
	}

	PlaceholderNose = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlaceholderNose"));
	PlaceholderNose->SetupAttachment(GetCapsuleComponent());
	PlaceholderNose->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PlaceholderNose->SetCanEverAffectNavigation(false);
	if (CubeMesh.Succeeded())
	{
		PlaceholderNose->SetStaticMesh(CubeMesh.Object);
	}

	UpdatePlaceholderBody();
}

void APVPlayerCharacter::UpdatePlaceholderBody()
{
	// Basic shapes are 100 units wide/tall with the pivot in the middle.
	const UCapsuleComponent* Capsule = GetCapsuleComponent();
	const float Radius = Capsule->GetUnscaledCapsuleRadius();
	const float HalfHeight = Capsule->GetUnscaledCapsuleHalfHeight();

	PlaceholderBody->SetRelativeScale3D(FVector(Radius * 2.f / 100.f, Radius * 2.f / 100.f, HalfHeight * 2.f / 100.f));
	PlaceholderNose->SetRelativeScale3D(FVector(0.2f, 0.2f, 0.2f));
	PlaceholderNose->SetRelativeLocation(FVector(Radius, 0.f, HalfHeight * 0.6f));
}

void APVPlayerCharacter::OnStartCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust)
{
	Super::OnStartCrouch(HalfHeightAdjust, ScaledHalfHeightAdjust);
	UpdatePlaceholderBody();
}

void APVPlayerCharacter::OnEndCrouch(float HalfHeightAdjust, float ScaledHalfHeightAdjust)
{
	Super::OnEndCrouch(HalfHeightAdjust, ScaledHalfHeightAdjust);
	UpdatePlaceholderBody();
}

void APVPlayerCharacter::Restart()
{
	Super::Restart();

	// With World Partition the ground may not be streamed in yet when we spawn,
	// and there may be no Player Start. Hold the player in place until ground is found.
	GetCharacterMovement()->DisableMovement();
	GroundSnapElapsed = 0.f;
	GetWorldTimerManager().SetTimer(GroundSnapTimer, this, &APVPlayerCharacter::TrySnapToGround, GroundSnapInterval, true);
	TrySnapToGround();
}

void APVPlayerCharacter::TrySnapToGround()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	GroundSnapElapsed += GroundSnapInterval;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(PVGroundSnap), false, this);
	const FVector Location = GetActorLocation();
	const float HalfHeight = GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	FHitResult Hit;

	// Ground right under us (normal Player Start): nothing to move.
	if (World->LineTraceSingleByChannel(Hit, Location, Location - FVector(0.f, 0.f, HalfHeight + 500.f), ECC_Visibility, Params))
	{
		FinishGroundSnap();
		return;
	}

	// Otherwise we may be under/inside the terrain or high in the air: search from far above.
	const FVector Above = Location + FVector(0.f, 0.f, 100000.f);
	const FVector Below = Location - FVector(0.f, 0.f, 100000.f);
	if (World->LineTraceSingleByChannel(Hit, Above, Below, ECC_Visibility, Params))
	{
		SetActorLocation(Hit.ImpactPoint + FVector(0.f, 0.f, HalfHeight + 10.f));
		FinishGroundSnap();
		return;
	}

	if (GroundSnapElapsed >= GroundSnapTimeout)
	{
		UE_LOG(LogTemp, Warning, TEXT("PVPlayerCharacter: no ground found under the player, releasing anyway."));
		FinishGroundSnap();
	}
}

void APVPlayerCharacter::FinishGroundSnap()
{
	GetWorldTimerManager().ClearTimer(GroundSnapTimer);
	GetCharacterMovement()->SetMovementMode(MOVE_Falling);
}

void APVPlayerCharacter::BuildInputMappings()
{
	auto MakeAction = [this](const TCHAR* Name, EInputActionValueType Type)
	{
		UInputAction* Action = NewObject<UInputAction>(this, FName(Name));
		Action->ValueType = Type;
		return Action;
	};

	MoveAction = MakeAction(TEXT("IA_Move"), EInputActionValueType::Axis2D);
	LookAction = MakeAction(TEXT("IA_Look"), EInputActionValueType::Axis2D);
	LookGamepadAction = MakeAction(TEXT("IA_LookGamepad"), EInputActionValueType::Axis2D);
	SprintAction = MakeAction(TEXT("IA_Sprint"), EInputActionValueType::Boolean);
	JumpAction = MakeAction(TEXT("IA_Jump"), EInputActionValueType::Boolean);
	CrouchAction = MakeAction(TEXT("IA_Crouch"), EInputActionValueType::Boolean);

	DefaultMappingContext = NewObject<UInputMappingContext>(this, TEXT("IMC_OnFoot"));
	UInputMappingContext* Context = DefaultMappingContext;

	// Note: MapKey returns a reference into an array, so add modifiers before the next MapKey call.
	auto AddSwizzle = [Context](FEnhancedActionKeyMapping& Mapping)
	{
		Mapping.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(Context)); // default order YXZ: X -> Y
	};
	auto AddNegate = [Context](FEnhancedActionKeyMapping& Mapping)
	{
		Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(Context));
	};
	auto AddDeadZone = [Context](FEnhancedActionKeyMapping& Mapping)
	{
		Mapping.Modifiers.Add(NewObject<UInputModifierDeadZone>(Context));
	};

	// Movement: D = +X (right), A = -X, W = +Y (forward), S = -Y.
	Context->MapKey(MoveAction, EKeys::D);
	AddNegate(Context->MapKey(MoveAction, EKeys::A));
	AddSwizzle(Context->MapKey(MoveAction, EKeys::W));
	{
		FEnhancedActionKeyMapping& S = Context->MapKey(MoveAction, EKeys::S);
		AddSwizzle(S);
		AddNegate(S);
	}
	AddDeadZone(Context->MapKey(MoveAction, EKeys::Gamepad_Left2D));

	// Camera.
	Context->MapKey(LookAction, EKeys::Mouse2D);
	AddDeadZone(Context->MapKey(LookGamepadAction, EKeys::Gamepad_Right2D));

	// Actions (GTA V layout).
	Context->MapKey(SprintAction, EKeys::LeftShift);
	Context->MapKey(SprintAction, EKeys::Gamepad_FaceButton_Bottom);   // A / Cross
	Context->MapKey(JumpAction, EKeys::SpaceBar);
	Context->MapKey(JumpAction, EKeys::Gamepad_FaceButton_Left);       // X / Square
	Context->MapKey(CrouchAction, EKeys::C);
	Context->MapKey(CrouchAction, EKeys::Gamepad_LeftThumbstick);      // L3
}

void APVPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (!DefaultMappingContext)
	{
		BuildInputMappings();
	}

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Subsystem->AddMappingContext(DefaultMappingContext, 0);
		}
	}

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		UE_LOG(LogTemp, Error, TEXT("PVPlayerCharacter: Enhanced Input is not enabled. Check Config/DefaultInput.ini."));
		return;
	}

	Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &APVPlayerCharacter::Move);
	Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &APVPlayerCharacter::Look);
	Input->BindAction(LookGamepadAction, ETriggerEvent::Triggered, this, &APVPlayerCharacter::LookGamepad);
	Input->BindAction(SprintAction, ETriggerEvent::Started, this, &APVPlayerCharacter::SprintPressed);
	Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &APVPlayerCharacter::SprintReleased);
	Input->BindAction(JumpAction, ETriggerEvent::Started, this, &APVPlayerCharacter::JumpPressed);
	Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &APVPlayerCharacter::JumpReleased);
	Input->BindAction(CrouchAction, ETriggerEvent::Started, this, &APVPlayerCharacter::ToggleCrouch);
}

void APVPlayerCharacter::Move(const FInputActionValue& Value)
{
	if (!Controller)
	{
		return;
	}

	const FVector2D Input = Value.Get<FVector2D>();
	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FRotationMatrix YawMatrix(YawRotation);

	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::X), Input.Y);
	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::Y), Input.X);
}

void APVPlayerCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D Input = Value.Get<FVector2D>();
	AddControllerYawInput(Input.X * MouseSensitivity);
	AddControllerPitchInput(-Input.Y * MouseSensitivity);
}

void APVPlayerCharacter::LookGamepad(const FInputActionValue& Value)
{
	const FVector2D Input = Value.Get<FVector2D>();
	const float Scale = GamepadLookSensitivity * GetWorld()->GetDeltaSeconds();
	AddControllerYawInput(Input.X * Scale);
	AddControllerPitchInput(-Input.Y * Scale);
}

void APVPlayerCharacter::SprintPressed()
{
	if (bIsCrouched)
	{
		UnCrouch();
	}

	// Tapping sprint quickly again and again builds up extra speed (like GTA).
	const float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastSprintTapTime < SprintTapWindow)
	{
		SprintBoost = FMath::Min(1.f, SprintBoost + SprintTapBoost);
	}
	LastSprintTapTime = Now;
	bSprintHeld = true;
}

void APVPlayerCharacter::SprintReleased()
{
	bSprintHeld = false;
}

void APVPlayerCharacter::JumpPressed()
{
	if (bIsCrouched)
	{
		UnCrouch();
		return;
	}
	Jump();
}

void APVPlayerCharacter::JumpReleased()
{
	StopJumping();
}

void APVPlayerCharacter::ToggleCrouch()
{
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		SprintBoost = 0.f;
		Crouch();
	}
}

void APVPlayerCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	UCharacterMovementComponent* MoveComp = GetCharacterMovement();
	const float Now = GetWorld()->GetTimeSeconds();

	SprintBoost = FMath::Max(0.f, SprintBoost - SprintBoostDecay * DeltaSeconds);

	const bool bWantsToMove = !MoveComp->GetCurrentAcceleration().IsNearlyZero();
	const bool bSprintInput = bSprintHeld || (Now - LastSprintTapTime < SprintTapWindow);
	const bool bSprinting = bSprintInput && bWantsToMove && !bIsCrouched;

	const float TargetSpeed = bSprinting ? FMath::Lerp(SprintSpeed, MaxSprintSpeed, SprintBoost) : JogSpeed;
	MoveComp->MaxWalkSpeed = FMath::FInterpTo(MoveComp->MaxWalkSpeed, TargetSpeed, DeltaSeconds, SpeedChangeRate);
	MoveComp->MaxWalkSpeedCrouched = CrouchSpeed;
}
