FROM python:3.11-slim

WORKDIR /app
COPY src/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY src/backend/app.py ./app.py
COPY src/backend/__init__.py ./__init__.py
COPY src/backend/__main__.py ./__main__.py
COPY src/config ./config
COPY artifacts ./artifacts

ENV DATABASE_URL=sqlite:///./mlops.db
ENV ARTIFACTS_PATH=/app/artifacts
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
