#!/usr/bin/env bash
# Snapshot the repo: git bundle (all history) + tarball of the working folder
# (includes untracked files) + checksums. Keeps the newest $KEEP snapshots.
# Usage: tools/backup.sh            Restore: git clone <file>.bundle blackjack-dojo
set -euo pipefail

KEEP=${KEEP:-10}
REPO=$(cd "$(dirname "$0")/.." && pwd)
NAME=$(basename "$REPO")
DEST=${BACKUP_DIR:-$HOME/backups/$NAME}
TS=$(date +%Y%m%d-%H%M%S)
BASE="bj-$TS"

umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"

cd "$REPO"
git bundle create "$DEST/$BASE.bundle" --all >/dev/null 2>&1
tar --exclude=node_modules -czf "$DEST/$BASE-worktree.tar.gz" -C "$(dirname "$REPO")" "$NAME"

cd "$DEST"
sha256sum "$BASE.bundle" "$BASE-worktree.tar.gz" > "$BASE.sha256"

# Verify before trusting it or deleting anything older.
git -C "$REPO" bundle verify "$DEST/$BASE.bundle" >/dev/null 2>&1
sha256sum -c --quiet "$BASE.sha256"
tar -tzf "$BASE-worktree.tar.gz" >/dev/null

# Prune: keep the newest $KEEP snapshots (names sort by timestamp).
ls -1 bj-*.sha256 | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
  b=${old%.sha256}
  rm -f -- "$b.sha256" "$b.bundle" "$b-worktree.tar.gz"
done

echo "Backup OK: $DEST/$BASE (.bundle, -worktree.tar.gz, .sha256)"
echo "Snapshots kept: $(ls -1 bj-*.sha256 | wc -l) (max $KEEP)"
