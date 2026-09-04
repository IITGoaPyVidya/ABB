FROM python:3.11-slim
WORKDIR /app
COPY src/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY src/backend/app.py src/backend/__init__.py src/backend/__main__.py ./
COPY src/config ./config
COPY artifacts ./artifacts
ENV DATABASE_URL=sqlite:////data/mlops.db
ENV ARTIFACTS_PATH=/app/artifacts
VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
