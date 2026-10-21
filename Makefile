.SHELLFLAGS := -eu -o pipefail -c
SHELL := /bin/bash

.PHONY: check pack clean

check:
	python3 -m json.tool metadata.json >/dev/null
	node --experimental-default-type=module --test tests/*.test.js
	glib-compile-schemas --strict --dry-run schemas
	@while IFS= read -r -d '' file; do node --experimental-default-type=module --check "$$file" || exit $$?; done < <(find . -type f -name '*.js' -not -path './.git/*' -print0)

pack:
	@command -v gnome-extensions >/dev/null 2>&1 || { echo "gnome-extensions is required (install GNOME Shell tools)" >&2; exit 1; }
	mkdir -p dist
	gnome-extensions pack --force --out-dir dist

clean:
	rm -rf dist
