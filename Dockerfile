# Multi-stage Docker build with cargo-chef dependency caching (bList style)
FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /app

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Pre-build dependencies - cached unless dependencies change
RUN cargo chef cook --release --recipe-path recipe.json
# Build application binary
COPY Cargo.toml Cargo.lock ./
COPY src ./src
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
