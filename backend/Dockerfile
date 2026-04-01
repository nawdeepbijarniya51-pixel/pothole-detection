FROM python:3.11-slim

WORKDIR /app

# Minimal system deps for OpenCV runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY potholevision_backend.py /app/potholevision_backend.py

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn potholevision_backend:app --host 0.0.0.0 --port ${PORT} --proxy-headers"]

