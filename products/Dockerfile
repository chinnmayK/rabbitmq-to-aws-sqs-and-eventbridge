# ---------- Build Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app/products

COPY products/package*.json ./
RUN npm ci --omit=dev

COPY products/ .

# ---------- Runtime Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app/products

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/products /app/products

# Copy shared modules (resolves ../../shared/ and ../../../shared/ imports)
COPY shared/ /app/shared/

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/products/global-bundle.pem

USER appuser

ENV PORT=8002

EXPOSE 8002

CMD ["node", "src/server.js"]