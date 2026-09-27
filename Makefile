export CANVA_CLI_DISABLE_TELEMETRY := true

.PHONY: lint-js release-check lock-check audit-js setup verify test test-js syntax-js test-app lint typecheck typecheck-app format-check-app audit audit-app build-app app-check check verify-fresh

setup:
	python -m pip install --disable-pip-version-check -r requirements.lock.txt
	npm ci --ignore-scripts
	npm --prefix canva-app ci --ignore-scripts

verify:
	python -m archive_verifier

test:
	python -m coverage run -m pytest -q
	python -m coverage report --fail-under=90

test-js:
	npm test

syntax-js:
	npm run verify:syntax

test-app:
	npm --prefix canva-app test

lint-js:
	npm run lint

release-check:
	npm run verify:release

lock-check:
	python scripts/verify_python_lock.py

audit-js:
	npm audit --audit-level=moderate

lint:
	python -m ruff check archive_verifier scripts tests

typecheck:
	python -m mypy archive_verifier scripts

typecheck-app:
	npm --prefix canva-app run typecheck

format-check-app:
	npm --prefix canva-app run format:check

audit:
	python -m pip check
	pip-audit -r requirements.lock.txt

audit-app:
	npm --prefix canva-app audit --omit=dev --audit-level=moderate
	@cd canva-app && \
		trap 'rm -f npm-audit.json' EXIT; \
		set +e; \
		npm audit --audit-level=moderate --json > npm-audit.json; \
		status=$$?; \
		set -e; \
		if [ "$$status" -eq 0 ]; then \
			echo "Design Editor dependency graph has no moderate-or-higher advisories."; \
		else \
			node scripts/verify-dev-audit.mjs npm-audit.json; \
		fi

build-app:
	npm --prefix canva-app run build

check: release-check lock-check lint-js lint typecheck test syntax-js test-js audit-js audit verify

app-check: audit-app format-check-app typecheck-app test-app build-app

verify-fresh: setup check app-check
