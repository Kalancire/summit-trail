#!/usr/bin/env bash
# Run on macOS after `npx cap add ios`. Adds everything Apple needs to the generated Xcode project:
# permission texts, background location, version numbers, a privacy manifest and an arm64 device requirement.
set -euo pipefail

PLIST="ios/App/App/Info.plist"
PBX="ios/App/App.xcodeproj/project.pbxproj"
PB=/usr/libexec/PlistBuddy
VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
BUILD="${BUILD_NUMBER:-1}"

put() { # put <Key> <type> <value>
  "$PB" -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$1 $2 $3" "$PLIST"
}

put NSLocationWhenInUseUsageDescription string "Shows your position on the map and records your hike."
put NSLocationAlwaysAndWhenInUseUsageDescription string "Keeps recording your route while the screen is off or the app is in the background."
put NSCameraUsageDescription string "Takes photos at your checkpoints during a hike."
put NSPhotoLibraryAddUsageDescription string "Saves your hike replay video to your photo library."
put NSPhotoLibraryUsageDescription string "Lets you choose a photo for your profile or a checkpoint."
put ITSAppUsesNonExemptEncryption bool false

# background location
"$PB" -c "Delete :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :UIBackgroundModes array" "$PLIST"
"$PB" -c "Add :UIBackgroundModes:0 string location" "$PLIST"

# Capacitor's template asks for 32-bit armv7; every supported iPhone is arm64
"$PB" -c "Delete :UIRequiredDeviceCapabilities" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :UIRequiredDeviceCapabilities array" "$PLIST"
"$PB" -c "Add :UIRequiredDeviceCapabilities:0 string arm64" "$PLIST"

# summittrail://trail/CODE opens a shared trail in the app
"$PB" -c "Delete :CFBundleURLTypes" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :CFBundleURLTypes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLName string com.summittrail.app" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string summittrail" "$PLIST"

# version shown in the App Store / TestFlight, and a build number that goes up every run
sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = ${VERSION};/g; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = ${BUILD};/g" "$PBX"

# privacy manifest (required by Apple), added to the app target
cp ios-resources/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
ruby <<'RUBY'
require 'xcodeproj'
proj = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = proj.targets.find { |t| t.name == 'App' }
group = proj.main_group.find_subpath('App', true)
ref = group.new_file('PrivacyInfo.xcprivacy')
target.resources_build_phase.add_file_reference(ref)
proj.save
RUBY

echo "Patched: version ${VERSION} (${BUILD}), permissions, background location, privacy manifest."
