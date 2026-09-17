.PHONY: setup verify test test-js test-app lint typecheck typecheck-app audit check verify-fresh

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

test-app:
	npm --prefix canva-app test

lint:
	python -m ruff check archive_verifier scripts tests

typecheck:
	python -m mypy archive_verifier scripts

typecheck-app:
	npm --prefix canva-app run typecheck

audit:
	python -m pip check
	pip-audit -r requirements.lock.txt

check: lint typecheck test test-js audit verify

verify-fresh: setup check typecheck-app test-app
