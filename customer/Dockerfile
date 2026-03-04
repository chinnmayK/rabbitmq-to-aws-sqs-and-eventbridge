# ---------- Build Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ---------- Runtime Stage ----------
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app /app

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/global-bundle.pem

USER appuser

ENV PORT=8001

EXPOSE 8001

CMD ["node", "src/server.js"]