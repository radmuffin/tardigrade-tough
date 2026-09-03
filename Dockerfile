FROM rust:1.80-slim-bookworm AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN cargo build --release --bin tardigrade-tough

FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tardigrade-tough /app/tardigrade-tough
COPY static /app/static

ENV PORT=3000
ENV DATABASE_PATH=/data/tardigrade.db
EXPOSE 3000

CMD ["/app/tardigrade-tough"]
