# ---------- Build Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app/customer

COPY customer/package*.json ./
RUN npm ci --omit=dev

COPY customer/ .

# ---------- Runtime Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app/customer

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/customer /app/customer

# Copy shared modules (resolves ../../shared/ and ../../../shared/ imports)
COPY shared/ /app/shared/

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/customer/global-bundle.pem

USER appuser

ENV PORT=8001

EXPOSE 8001

CMD ["node", "src/server.js"]