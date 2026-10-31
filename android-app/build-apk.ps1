$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$gradleRoot = $projectRoot
$buildLink = $null
$cmakeVersion = '3.31.6'
$localTools = Join-Path $env:LOCALAPPDATA 'saldo-build-tools'
$portableNode = Join-Path $localTools 'node-v22.23.4-win-x64'
$sdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $portableNode 'node.exe'))) {
  $env:PATH = "$portableNode;$env:PATH"
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22 ou superior é necessário. Instale o Node.js e tente novamente.'
}

if (-not $env:JAVA_HOME) {
  $jdkRoot = Join-Path $localTools 'temurin17'
  if (Test-Path $jdkRoot) {
    $javac = Get-ChildItem -LiteralPath $jdkRoot -Filter javac.exe -Recurse | Select-Object -First 1
    if ($javac) {
      $env:JAVA_HOME = Split-Path (Split-Path $javac.FullName -Parent) -Parent
    }
  }
}
if (-not $env:JAVA_HOME -and (Get-Command java.exe -ErrorAction SilentlyContinue)) {
  $env:JAVA_HOME = Split-Path (Split-Path (Get-Command java.exe).Source -Parent) -Parent
}
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  throw 'Java 17 ou superior não encontrado. Instale um JDK e configure JAVA_HOME.'
}
if (-not (Test-Path $sdkRoot)) {
  throw "Android SDK not found at '$sdkRoot'. Install the SDK and set ANDROID_SDK_ROOT."
}
foreach ($required in @(
  'platforms\android-37.0\android.jar',
  'build-tools\37.0.0\aapt2.exe',
  'ndk\27.1.12297006\ndk-build.cmd',
  "cmake\$cmakeVersion\bin\cmake.exe"
)) {
  if (-not (Test-Path (Join-Path $sdkRoot $required))) {
    throw "Required Android SDK component is missing: $required"
  }
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$(Join-Path $sdkRoot 'platform-tools');$env:PATH"
$env:NODE_OPTIONS = '--max_old_space_size=4096 --preserve-symlinks'
$expo = Join-Path $projectRoot 'node_modules\.bin\expo.cmd'

if (-not (Test-Path $expo)) {
  throw 'App dependencies not found. Run npm install inside the android-app folder.'
}

if ($projectRoot.Contains(' ')) {
  $buildLink = Join-Path $env:TEMP ('s' + $PID)
  if (Test-Path $buildLink) {
    throw "Temporary build path already exists: $buildLink"
  }
  New-Item -ItemType Junction -Path $buildLink -Target $projectRoot | Out-Null
  $gradleRoot = $buildLink
  $expo = Join-Path $gradleRoot 'node_modules\.bin\expo.cmd'
}

try {
  Write-Output 'Preparing the native Android project...'
  & $env:ComSpec /d /c "cd /d `"$gradleRoot`" && `"$expo`" prebuild --platform android --no-install"
  if ($LASTEXITCODE -ne 0) {
    throw 'Expo could not prepare the Android project.'
  }

  $gradlePropertiesPath = Join-Path $gradleRoot 'android\gradle.properties'
  $gradleProperties = Get-Content -LiteralPath $gradlePropertiesPath
  $cmakeProperty = "android.cmakeVersion=$cmakeVersion"
  if ($gradleProperties -match '^android\.cmakeVersion=') {
    $gradleProperties = $gradleProperties -replace '^android\.cmakeVersion=.*$', $cmakeProperty
  } else {
    $gradleProperties += $cmakeProperty
  }
  Set-Content -LiteralPath $gradlePropertiesPath -Value $gradleProperties -Encoding ascii

  $gradle = Join-Path $gradleRoot 'android\gradlew.bat'
  if (-not (Test-Path $gradle)) {
    throw 'Expo did not create the Gradle Wrapper.'
  }

  Write-Output 'Building the release APK...'
  & $env:ComSpec /d /c "cd /d `"$gradleRoot\android`" && `"$gradle`" --no-daemon --max-workers=2 assembleRelease"
  if ($LASTEXITCODE -ne 0) {
    throw 'Android build failed. Review the Gradle output above.'
  }

  $builtApk = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path $builtApk)) {
    throw 'Gradle finished without generating the expected APK.'
  }

  $apk = Join-Path $projectRoot 'Saldo.apk'
  Copy-Item -LiteralPath $builtApk -Destination $apk -Force
  Write-Output "APK ready: $apk"
  Get-Item -LiteralPath $apk | Select-Object FullName, Length, LastWriteTime
}
finally {
  if ($buildLink) {
    & $env:ComSpec /d /c "rmdir `"$buildLink`""
    if ($LASTEXITCODE -ne 0) {
      throw 'Could not remove the temporary build junction.'
    }
  }
}
