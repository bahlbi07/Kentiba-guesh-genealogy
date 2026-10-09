# Multi-stage Docker build for Kinteba Guush Rust API
FROM rust:1.80-slim-bullseye AS builder

WORKDIR /usr/src/app
COPY Cargo.toml Cargo.lock* ./
# Pre-build dummy to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Copy real source code
COPY src ./src
COPY migrations ./migrations

# Build release binaries
RUN cargo build --release

# Minimal runtime image
FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates libsqlite3-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /usr/src/app/target/release/server /app/server
COPY --from=builder /usr/src/app/target/release/init_admin /app/init_admin

ENV PORT=3001
ENV DATABASE_PATH=/app/data/kinteba_genealogy.db
VOLUME ["/app/data"]

EXPOSE 3001

CMD ["/app/server"]

