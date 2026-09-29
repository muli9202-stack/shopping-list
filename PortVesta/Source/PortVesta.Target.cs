using UnrealBuildTool;
using System.Collections.Generic;

public class PortVestaTarget : TargetRules
{
	public PortVestaTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("PortVesta");
	}
}
