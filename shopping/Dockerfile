FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

# Copy service package.json to root to install all dependencies at /app/node_modules
COPY shopping/package*.json ./
RUN npm ci --omit=dev

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY shopping/ ./shopping/

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/shopping/global-bundle.pem

# Create non-root user and fix permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

ENV PORT=8003
EXPOSE 8003

CMD ["node", "shopping/src/server.js"]