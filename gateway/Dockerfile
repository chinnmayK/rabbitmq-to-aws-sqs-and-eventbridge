###############################################
#                BASE IMAGE                   #
###############################################
FROM public.ecr.aws/docker/library/node:20-alpine AS base

ENV NPM_CONFIG_LOGLEVEL=warn \
    NODE_ENV=production

WORKDIR /app



###############################################
#             DEPENDENCY STAGE                #
#  Installs node dependencies                 #
###############################################
FROM base AS dependencies

COPY package*.json ./

RUN npm ci --omit=dev

RUN npm cache clean --force



###############################################
#               BUILD STAGE                   #
#   Copies application source after deps      #
###############################################
FROM dependencies AS build

COPY . .

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
    tini

RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

COPY --from=build /app /app

RUN chown -R appuser:appgroup /app

USER appuser

###############################################
#              SECURITY SETTINGS              #
###############################################
ENTRYPOINT ["/sbin/tini", "--"]

ENV PORT=8000 \
    NODE_ENV=production

EXPOSE 8000

###############################################
#                START COMMAND                #
###############################################
CMD ["node", "index.js"]
