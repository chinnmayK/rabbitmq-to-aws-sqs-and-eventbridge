# -------- Build Stage --------
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# -------- Runtime Stage --------
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app /app

USER appuser

# default port for gateway
ENV PORT=8000

EXPOSE 8000

# runtime entrypoint at project root
CMD ["node", "index.js"]
