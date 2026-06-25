# ============================================================
# ConvoGuard Analysis Engine — Production Dockerfile
# ============================================================
FROM python:3.11-slim AS base

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# ---- Dependencies layer (cached) ----
FROM base AS deps
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# ---- Application layer ----
FROM deps AS app
COPY src/ ./src/

# Pre-download sentence-transformer model so startup is fast
RUN uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Optional: copy pre-trained classifier weights if available
# COPY models/ ./models/

# ---- Runtime ----
FROM app AS runtime

ENV PYTHONUNBUFFERED=1
ENV ANALYSIS_ENGINE_PORT=8001
ENV LOG_LEVEL=info

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uv", "run", "uvicorn", "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "1", \
     "--log-level", "info"]
