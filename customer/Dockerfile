FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

# Copy service package.json to root to install all dependencies at /app/node_modules
COPY customer/package*.json ./
RUN npm ci --omit=dev

# Copy shared modules
COPY shared/ ./shared/

# Copy service code
COPY customer/ ./customer/

# Download AWS DocumentDB TLS CA bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/customer/global-bundle.pem

# Create non-root user and fix permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

ENV PORT=8001
EXPOSE 8001

CMD ["node", "customer/src/server.js"]