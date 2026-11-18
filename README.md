# Tehillim Sign Review

This static reviewer includes 400 questions, their scan crops and Hebrew text.
Answers save immediately in IndexedDB on the device. When the page reopens,
review starts at the first unanswered question. Use **Show → All items** to
revisit answers. Use **Backup answers** to save a JSON copy and **Restore backup**
to add missing decisions from a copy. Restoring preserves answers already on
the device.

## GitHub Pages

Push this directory, including `.nojekyll`, to the repository's `main` branch.
In **Settings → Pages**, choose **Deploy from a branch**, then `main` and
`/(root)`. Open the resulting HTTPS URL in Safari. No backend is needed.

Keep decision backups outside the public repository. Use **Restore backup**
once on the published URL to bring in your earlier decisions from a JSON file.
Storage is tied to the site's origin and Safari profile.
