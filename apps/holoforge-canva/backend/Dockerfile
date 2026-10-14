FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8082

WORKDIR /app

COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

COPY . ./

EXPOSE 8082

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8082} --proxy-headers"]
