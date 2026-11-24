#!/usr/bin/env bash
# Builds and packs every public package (public-packages.mjs) into the given folder, then
# checks the tarballs (check-pack.mjs). Same tarballs in CI (ci.yml) and at release
# (release-npm.yml): what CI checked is what npm receives.
#   .github/scripts/pack-public.sh <destination>
set -euo pipefail

dest="${1:?usage: pack-public.sh <destination>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"

mapfile -t packages < <(node .github/scripts/public-packages.mjs)
if [ "${#packages[@]}" -eq 0 ]; then
  echo "no public @devitek package" >&2
  exit 1
fi

# Published packages carry the server version (D181): release-please bumps them together
# through `extra-files` (release-please-config.json).
expected="$(node -p "require('./package.json').version")"
for line in "${packages[@]}"; do
  read -r name dir version <<<"$line"
  if [ "$version" != "$expected" ]; then
    echo "${name} (${dir}) is ${version}, the server is ${expected}: add it to extra-files" >&2
    exit 1
  fi
done

# The public packages only, in topological order. Their private workspace dependencies
# are TypeScript sources bundled by tsdown, with no build of their own (`name...` would
# also select the app, a dev dependency of the SDK tests, and build it for nothing).
filters=()
for line in "${packages[@]}"; do
  read -r name _ _ <<<"$line"
  filters+=(--filter "${name}")
done
pnpm "${filters[@]}" run --if-present build

copied=()
cleanup() { for file in "${copied[@]}"; do rm -f "$file"; done; }
trap cleanup EXIT

for line in "${packages[@]}"; do
  read -r name dir version <<<"$line"
  # The LICENSE lives at the repository root; npm only ships the one of the package folder.
  if [ ! -e "$dir/LICENSE" ]; then
    cp LICENSE "$dir/LICENSE"
    copied+=("$dir/LICENSE")
  fi
  # pnpm pack (not npm pack): it rewrites `workspace:` ranges and applies publishConfig.
  (cd "$dir" && pnpm pack --pack-destination "$dest" >/dev/null)
  echo "packed ${name}@${version} (${dir})"
done

node .github/scripts/check-pack.mjs "$dest"/*.tgz
