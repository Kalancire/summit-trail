# Live location sharing: one-time setup

1. **Firestore rules** (Firebase console > Firestore > Rules). Add this inside `match /databases/{database}/documents { ... }`:

```
match /live/{code} {
  allow read: if true;   // anyone with the unguessable 10-character code can watch
  allow create, update: if request.auth != null && (resource == null || resource.data.owner == request.auth.uid);
  allow delete: if false;
}
```

2. **Optional web link** (so family can watch without the app): GitHub repo > Settings > Pages > Source = "GitHub Actions".
   The `pages.yml` workflow then publishes the viewer at `https://<you>.github.io/<repo>/`.
   In Firebase > Authentication > Settings > Authorized domains, add `<you>.github.io`.

How it works: tap **Share live** during a hike. A code like `k3m9x2p7qa` is created and shared. The hiker's position and route are
uploaded every 15 s (60 s when standing still) while there is signal. Sharing stops when you finish, leave the screen, or after 24 h.
Nothing is shared unless you tap the button.
