FROM node:22-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv "$VIRTUAL_ENV"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY requirements.lock.txt ./
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.lock.txt

COPY . .

CMD ["sh", "-c", "python -m archive_verifier && python -m coverage run -m pytest -q && python -m coverage report --fail-under=90 && npm test"]
