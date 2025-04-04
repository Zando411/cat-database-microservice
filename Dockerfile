FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads

EXPOSE 3214

CMD ["npm", "start"]