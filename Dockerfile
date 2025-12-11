# syntax=docker/dockerfile:1

#############################################
# build stage
#############################################
FROM node:18-alpine AS build

RUN apk add --no-cache python3 make g++ bash

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

#############################################
# production stage
#############################################
FROM node:18-alpine AS prod

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json

RUN npm ci --only=production --silent

ENV NODE_ENV=production
ENV PORT=5000

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- --timeout=3 http://127.0.0.1:5000/ || exit 1

CMD ["node", "dist/index.cjs"]
