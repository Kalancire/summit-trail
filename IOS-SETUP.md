# Summit Trail on iOS

Same React code, new native shell. The iOS project is generated on GitHub (like Android), so there is no `ios/` folder to commit.

Built with Xcode 26 / iOS 26 SDK (Apple's current minimum for uploads). The app runs on iOS 15 up to the newest iOS.

## One-time Apple setup
1. Join the Apple Developer Program ($99/year).
2. developer.apple.com > Identifiers: register bundle ID `com.summittrail.app` (Location and Background Modes need nothing extra).
3. App Store Connect > Apps > New App, using that bundle ID.
4. App Store Connect > Users and Access > Integrations > App Store Connect API: create a key with **App Manager** access. Download the `.p8` file once. Note the Key ID and Issuer ID.
5. Find your Team ID in developer.apple.com > Membership.

## GitHub secrets (Settings > Secrets and variables > Actions)
Already there: the 5 VITE_* secrets. Add:
| Secret | Value |
|---|---|
| APPLE_TEAM_ID | Team ID |
| ASC_KEY_ID | API key ID |
| ASC_ISSUER_ID | API issuer ID |
| ASC_PRIVATE_KEY | full text of the .p8 file, including the BEGIN/END lines |

## Running it
- Every push to main (or Actions > **Build iOS** > Run workflow, testflight **off**) builds `SummitTrail-iOS.ipa` and attaches it to a release named "Summit Trail iOS build N". Android stays in its own "Summit Trail build N" release. No Apple account needed. Install the .ipa with Sideloadly or AltStore (free Apple ID, expires after 7 days).
- testflight **on**: signs and uploads. Install through the TestFlight app on your iPhone after processing (about 10 minutes).

## Before App Store submission
- Account deletion is already in the app (Profile > Delete my account), which Apple requires.
- Privacy policy URL, screenshots, and the privacy label (location, email, name, photos, user ID, not used for tracking).
- Test background tracking on a real iPhone with "Always" location.
- Firebase: add an iOS app only if you later add Google sign-in.
