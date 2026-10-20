FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
VOLUME /app/data
CMD ["sh", "-c", "node src/deploy-commands.js && node src/index.js"]
