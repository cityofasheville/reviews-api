# Official node image. Trying alpine to keep the image as tight as possible.
FROM node:10

# Folder where the app will be copied to
# will by the target of the docker file commands
WORKDIR /opt

# Copy package.json + package-lock.json files
COPY package*.json ./

# Installing dependencies
RUN npm install

# Bundle app source
COPY . .

# Exposes port 4000
EXPOSE 4000

# Runs Server at container start
ENTRYPOINT ["npm", "start"]


