# ---------- Build Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app/shopping

COPY shopping/package*.json ./
RUN npm ci --omit=dev

COPY shopping/ .

# ---------- Runtime Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app/shopping

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/shopping /app/shopping

# Copy shared modules (resolves ../../shared/ and ../../../shared/ imports)
COPY shared/ /app/shared/

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/shopping/global-bundle.pem

USER appuser

ENV PORT=8003

EXPOSE 8003

CMD ["node", "src/server.js"]