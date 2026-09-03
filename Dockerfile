FROM rust:1.80-slim-bookworm AS builder
WORKDIR /workspace

# Copy fly-common and tardigrade-tough for local path resolution
COPY fly-common ./fly-common
COPY tardigrade-tough ./tardigrade-tough

WORKDIR /workspace/tardigrade-tough
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/tardigrade-tough/target/release/tardigrade-tough /app/tardigrade-tough
COPY --from=builder /workspace/tardigrade-tough/static /app/static

ENV PORT=3000
ENV DATABASE_PATH=/data/tardigrade.db
EXPOSE 3000

CMD ["/app/tardigrade-tough"]
