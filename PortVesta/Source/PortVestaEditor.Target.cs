using UnrealBuildTool;
using System.Collections.Generic;

public class PortVestaEditorTarget : TargetRules
{
	public PortVestaEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("PortVesta");
	}
}
