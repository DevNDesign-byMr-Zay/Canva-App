.PHONY: setup verify test test-js lint typecheck audit check

setup:
	python -m pip install --disable-pip-version-check -r requirements.lock.txt

verify:
	python -m archive_verifier

test:
	python -m coverage run -m pytest -q
	python -m coverage report --fail-under=90

test-js:
	npm test

lint:
	python -m ruff check archive_verifier scripts tests

typecheck:
	python -m mypy archive_verifier scripts

audit:
	python -m pip check
	pip-audit -r requirements.lock.txt

check: lint typecheck test test-js audit verify
