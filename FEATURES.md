# New features (trails, safety, peaks, journal, extras)

## Trails
- **Save as a trail**: toggle before you start a hike. When you stop, fill in name, difficulty, description and cover photo. Distance, climb, highest point and estimated time (Naismith's rule) are calculated.
- **Also from any past hike**: Summary > Save as trail.
- **Draw a trail**: My Trails > Draw a trail. Tap points on the map; pick an icon and tap to drop a waypoint. Climb and highest point come from the free Open-Meteo elevation service (needs internet).
- **Waypoints**: water, viewpoint, campsite, hazard. Each has a photo and note. Add them with the flag/camera button while hiking.
- **My Trails tab** (new icon in the bottom bar): list with a map preview, difficulty and stats.
- **Follow a trail**: open a trail > Follow this trail. Live shows the dashed trail, % done, distance left, and warns (red banner, voice, vibration) when you are more than 50 m off it.
- **Export and share**: GPX file, or Share link (`summittrail://trail/CODE`, plus a code the other person can paste in My Trails > Import).

## Safety
- **Check-in timer**: choose 1 to 4 h (or trail estimate +50%) before you start. At the deadline the app asks "Are you okay?". No answer in 2 minutes opens your messages app with your location to your emergency contact.
- **SOS button**: coordinates, altitude and a map link by message or the share sheet.
- **Low battery** (20% and 10%), **sunset** (60 and 30 min before, and "you may finish after sunset" on a trail), **rain** warnings.
- Set the contact in Profile > Emergency contact.

## Peaks, journal, extras
- **Peak log**: each hike that climbs at least 40 m logs its highest point. My Trails > Peaks is a passport of summits with the dates you visited. Tap one to name it.
- **Trail journal**: checkpoints carry a note, a photo and an icon. Summary shows them as a story and lets you edit the notes.
- **Backtrack**: the arrow button while recording draws a blue line back along the path you came on, with distance and direction.
- **Weather** card on Home, with a rain warning for the next 3 hours.
- **Replay video** shows each checkpoint photo and note as the line passes it.

## Limits to know
- Phones do not let an app send an SMS silently. The app opens the message with the text filled in; the person taps Send.
- Check-in and rain checks run while the app is recording. If the OS suspends the app, they pause until it wakes.
- Battery warnings do not work on iPhone (Apple does not expose battery level to web apps).
- Trail photos stay on the phone; only the cover photo syncs to your cloud account.

## One Firebase change for share links
Firestore > Rules, add inside `match /databases/{database}/documents`:
```
match /sharedTrails/{code} {
  allow get: if true;
  allow list: if request.auth != null && resource.data.owner == request.auth.uid;
  allow create: if request.auth != null && request.resource.data.owner == request.auth.uid;
  allow update, delete: if request.auth != null && resource.data.owner == request.auth.uid;
}
```
Your own trails sync under `users/{uid}/trails`, which your existing per-user rule should already cover.
