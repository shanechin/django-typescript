FROM node:22


WORKDIR /app

COPY src/index.ts /src/index.ts
COPY src/test.ts /src/test.ts
COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json
COPY tsconfig.module.json /app/tsconfig.module.json

RUN npm install