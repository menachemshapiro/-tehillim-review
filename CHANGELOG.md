# Tehillim Sign Review changelog

Dates are in Israel local time. Commit links point to the corresponding GitHub changes.

## November 19, 2026

### Expanded review batch and issue-level review
[Commit `7cc740d9`](../../commit/7cc740d95f317d0d570713208c8a580a08810c55)

- Published the `review_v980.json` batch with 678 items and their scan crops. The upload contains 278 additional items alongside the original 400.
- Checked all 403 answered decision IDs from the latest supplied backup against the expanded batch. All matched, leaving 275 unanswered at the time of the backup. The reviewer continues to match saved decisions by ID and use the same browser database. Personal backups stay in the reviewer's import and export workflow.
- Added **Review options → Issue**, which filters by the exact sign or issue. Patach, Kamatz, Munach, and Meteg (Meseg) can each be reviewed on their own while retaining the broader sign group and answered-status filters.
- Made the reported **New edition** count tappable. **Flag count** records that the count shown for the new edition is suspect. It stays on the current item so the reviewer can still record what the old edition shows. Tap the count again to clear the flag.
- Included new-edition count flags in backups and restores. Undoing an answer preserves its independently recorded count flag.

### Correction-pattern report updated to 403 decisions
[Commit `99750ab0`](../../commit/99750ab0627af5b4bfcb38b72db8f6d49d46bfb8) · [Full report](reports/TEHILLIM_CORRECTION_PATTERNS_2026-11-18.txt)

- Added the final supplied set of 126 decisions since the preceding report, bringing the cumulative total to 403 decisions.
- Expanded the report to 21 categories, with supporting examples and unresolved cases. Examples can support more than one category.

## November 18, 2026

### Review workflow and diagnostic flags

- **Separate Patach and Kamatz passes.** Recorded the preference to review all Patach items first and then all Kamatz items, while keeping both available as answers when appropriate. [Review notes](review-notes.md) · [Commit `86ef2f8b`](../../commit/86ef2f8bd33279a3cf4bae3ecb718080d6adc1d6)
- **Pictures don’t match.** Added a button beside the zoom controls for items where the scan crops appear to show different words or locations. It saves as the item's review decision, is included in backups, works with Auto-next, and can be undone. [Commit `0d5a8489`](../../commit/0d5a8489)
- **Whole-word acceptance.** Added **Use Sefaria** and **Use Kit reconstruction**. Tapping either label or its Hebrew transcription records the selected source and exact pointed Hebrew as a complete answer. This works with Auto-next, Undo, and backups. The individual sign and count choices remain available. [Commit `8c6e6870`](../../commit/8c6e6870528bcf3e87c7ba9b86f25c44394fee70)

### Correction-pattern report

- Published the first detailed catalog from 167 annotated decisions, with examples for the patterns discussed. [Commit `a85fdc02`](../../commit/a85fdc02)
- Expanded the catalog to 277 decisions and 18 categories as more review results came in. [Commit `82057a41`](../../commit/82057a41)

### iPhone layout and navigation

- Rearranged review cards to keep the scan crops and answer controls visible together in portrait and landscape. Moved secondary controls under **Review options** and made Next and Auto-next return the card to the top. [Commit `f3c9abf1`](../../commit/f3c9abf1a0be714589b056c0f9bbd72aefa249bb)
- Restored the Hebrew comparison and answer-source hints where room permits. In landscape, moved the Hebrew comparison below the scan crops and arranged answers in three columns when wide enough. [Commit `faa4c62f`](../../commit/faa4c62fc7bdb745c2b3937d2a14e1f2358f6a84)

### Initial GitHub Pages release

- Published a 400-item reviewer with old-print, new-edition, and Kit scan comparisons, selectable Hebrew text, and controls for zoom, navigation, Auto-next, and Undo.
- Saved answers to IndexedDB on the device with a visible save status. Added JSON backups and restore by item ID, including the ability to transfer answers to another browser. The initial personal backup contained 10 decisions, seven of which matched the original 400 items.
- Included sign-group and verdict filters, search, notes, and slide and list views. [Commit `810f08c1`](../../commit/810f08c197ebf04cf6a8d460fbec1aa8d9d42c81)
