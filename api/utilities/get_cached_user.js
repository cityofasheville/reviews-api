const getCachedUser = (context) => {
  return context.cache.get(context.sessionId)
    .then((cData) => {
      return Promise.resolve((cData) ? cData.user : {});
    });
}

module.exports = getCachedUser;
