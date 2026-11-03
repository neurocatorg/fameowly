#!/usr/bin/env bash
# Build the premium image from the committed HEAD (plus the extensions commit it records)
# and, when a host is given, stream it over SSH, retag it as fameowly-premium:local and deploy.
#
# Usage: scripts/deploy-image.sh [user@host]
# Env:   DEPLOY_DIR (default /opt/fameowly), KEEP_IMAGES (sha-* tags kept on the host, default 3)
set -euo pipefail

host=${1:-}
deploy_dir=${DEPLOY_DIR:-/opt/fameowly}
keep=${KEEP_IMAGES:-3}
repo=fameowly-premium

cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --short HEAD)
ext_sha=$(git ls-tree HEAD extensions | awk '{print $3}')
if [[ -z $ext_sha ]]; then
  echo "HEAD records no extensions submodule — premium image needs it" >&2
  exit 1
fi
if ! git -C extensions cat-file -e "$ext_sha^{commit}" 2>/dev/null; then
  echo "extensions commit $ext_sha is missing locally: run git submodule update --init" >&2
  exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
  echo "warning: uncommitted changes are NOT in the image; building $sha" >&2
fi

# Build from an export of the commit, never from the working tree
ctx=$(mktemp -d)
trap 'rm -rf "$ctx"' EXIT
git archive HEAD | tar -x -C "$ctx"
mkdir -p "$ctx/extensions"
git -C extensions archive "$ext_sha" | tar -x -C "$ctx/extensions"

tag="$repo:sha-$sha"
docker build --pull -t "$tag" \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" "$ctx"

if [[ -z $host ]]; then
  echo "built $tag; ship it with: scripts/deploy-image.sh user@host"
  exit 0
fi

echo "shipping $tag to $host"
docker save "$tag" | gzip -1 | ssh "$host" "gunzip | docker load"
ssh "$host" bash -s -- "$tag" "$repo" "$deploy_dir" "$keep" <<'REMOTE'
set -euo pipefail
tag=$1 repo=$2 dir=$3 keep=$4
docker tag "$tag" "$repo:local"
cd "$dir" && ./deploy.sh fameowly
# Older sha-* tags beyond the newest $keep are dropped; rollback = retag one as :local
docker images "$repo" --format '{{.Tag}}' | grep '^sha-' | tail -n +"$((keep + 1))" \
  | xargs -r -I{} docker rmi "$repo:{}"
REMOTE
