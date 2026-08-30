FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production=false
COPY . .
RUN npm run build
EXPOSE 10000
CMD ["node", "dist/server.js"]
