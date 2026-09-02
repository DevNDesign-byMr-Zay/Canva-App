FROM python:3.12-slim

WORKDIR /app

COPY requirements.lock.txt ./
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.lock.txt

COPY . .

CMD ["sh", "-c", "python -m archive_verifier && python -m coverage run -m pytest -q && python -m coverage report --fail-under=90"]
