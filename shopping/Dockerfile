###############################################
#                BASE IMAGE                   #
###############################################
FROM public.ecr.aws/docker/library/node:20-alpine AS base

ENV NPM_CONFIG_LOGLEVEL=warn \
    NODE_ENV=production

WORKDIR /app



###############################################
#             DEPENDENCY STAGE                #
#  Installs build tools + node dependencies   #
###############################################
FROM base AS dependencies

# Build tools required to compile native modules (bcrypt)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    libc6-compat

COPY shopping/package*.json ./

RUN npm ci --omit=dev

RUN npm cache clean --force



###############################################
#               BUILD STAGE                   #
#   Copies application source after deps      #
###############################################
FROM dependencies AS build

COPY shared/ ./shared/
COPY shopping/ ./shopping/

RUN rm -rf \
    /root/.npm \
    /tmp/*



###############################################
#            RUNTIME STAGE (FINAL)            #
#     Lightweight, secure production image    #
###############################################
FROM public.ecr.aws/docker/library/node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache \
    ca-certificates \
    wget \
    tini

RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

COPY --from=build /app /app

# Download AWS DocumentDB TLS global bundle
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -O /app/global-bundle.pem

RUN chown -R appuser:appgroup /app

USER appuser

###############################################
#              SECURITY SETTINGS              #
###############################################
ENTRYPOINT ["/sbin/tini", "--"]

ENV PORT=8003 \
    NODE_ENV=production

EXPOSE 8003

###############################################
#                START COMMAND                #
###############################################
CMD ["node", "shopping/src/server.js"]