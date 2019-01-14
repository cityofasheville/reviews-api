const cache = require('coa-web-cache');
const getDbConnection = require('../common/db');
const logger = require('../common/logger');

const middlewares = [
  function checkSuperuser(req, res, next) { // Get superuser status
    if (req.session && req.session.id) {
      cache.get(req.session.id)
        .then((cData) => {
          let user = {};
          if (cData && cData.user) ({ user } = cData);
          if (user.id && user.superuser === undefined) {
            const conn = getDbConnection('reviews');
            return conn
              .query(`SELECT * FROM reviews.superusers WHERE emp_id = ${user.id} limit 1`)
              .then((result) => {
                if (result.rows.length === 1) {
                  user.superuser = result.rows[0].is_superuser !== 0;
                  if (user.superuser) logger.warn(`Superuser login by ${user.email}'`);
                }
                const cDataNew = Object.assign({}, cData, { user });
                return cache.store(req.session.id, cDataNew);
              })
              .then(() => {
                next();
                return (Promise.resolve(null));
              });
          }
          next();
          return (Promise.resolve(null));
        });
    } else next();
  },
];

module.exports = middlewares;
