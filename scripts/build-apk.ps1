param(
  [ValidateSet("apk", "aab")]
  [string]$Target = "apk"
)

$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkPath = "$env:LOCALAPPDATA\Android\jdk21"
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"

if (Test-Path "$jdkPath\bin\java.exe") {
  $env:JAVA_HOME = $jdkPath
  $env:PATH = "$jdkPath\bin;$env:PATH"
}
if (Test-Path $sdkPath) {
  $env:ANDROID_HOME = $sdkPath
  $env:ANDROID_SDK_ROOT = $sdkPath
}

Set-Location $projectRoot
npm run cap:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location "$projectRoot\android"
if ($Target -eq "aab") {
  cmd.exe /c "gradlew.bat bundleRelease --no-daemon"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $aabSrc = "$projectRoot\android\app\build\outputs\bundle\release\app-release.aab"
  $aabDest = "$projectRoot\StageLog-v1.0.aab"
  Copy-Item -Force $aabSrc $aabDest
  Write-Output "AAB pronto em: $aabDest"
} else {
  cmd.exe /c "gradlew.bat assembleRelease --no-daemon"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $apkSrc = "$projectRoot\android\app\build\outputs\apk\release\app-release.apk"
  $apkDest = "$projectRoot\StageLog-v1.0.apk"
  Copy-Item -Force $apkSrc $apkDest
  Write-Output "APK pronto em: $apkDest"
}
