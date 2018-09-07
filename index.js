const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

require('dotenv').config();
const apiConfig = require('./api/config');
const getDbConnection = require('./common/db');

const MemoryStore = require('memorystore')(session)
const CacheClient = require('coa-web-cache');
const { checkLogin } = require('coa-web-login');
const getUserInfo = require('./common/get_user_info');

const GRAPHQL_PORT = process.env.PORT || 4000;

const app = express();

// Set up the cache
cache = new CacheClient();
let sessionCache = null;
const cacheMethod = process.env.cache_method || 'memory';
if (cacheMethod === 'memory') {
  sessionCache = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
} else {
  throw new Error('Redis caching not yet implemented');
}

// Initialize session management
app.use(session({
  name: process.env.sessionName,
  secret: process.env.sessionSecret, 
  resave: false,
  saveUninitialized: true,
  store: sessionCache,
  cookie: { 
    httpOnly: true,
    secure: 'auto',
    maxAge: 1000 * 60 * 60 * 24 * process.env.maxSessionDays,
  },
}));

// Set up CORS
const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
};
app.use(cors(corsOptions));


if (apiConfig.enableEmployeeLogins) {
  getDbConnection('mds'); // Initialize the connection.
}

// Check whether the user is logged in
app.use(function (req, res, next) {
  checkLogin(req, cache.get(req.session.id), cache)
  .then(isLoggedIn => {
    return getUserInfo(isLoggedIn, apiConfig.enableEmployeeLogins, req, cache);
  })
  .then(() => { next(); });
});

// Add in any middleware defined by the API
require('./api').middlewares.forEach(m => { app.use(m); });

// Now configure and apply the GraphQL server

const server = new ApolloServer({ 
  typeDefs: require('./schema'),
  resolvers: require('./resolvers'),
  context: ({ req }) => {
    return {
      session: req.session,
      req: req,
      cache,
    };
  },
});

server.applyMiddleware({ app, cors: corsOptions });

// And off we go!
app.listen({ port: GRAPHQL_PORT }, () => {
  console.log(`Server ready at http://localhost:${GRAPHQL_PORT}${server.graphqlPath}`);
});
