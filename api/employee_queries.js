const getDbConnection = require('../common/db');
const logger = require('../common/logger');
const operationIsAllowed = require('./utilities/operation_is_allowed');
const { loadEmployeeFromCache, getEmployee } = require('./utilities/employees_info');

const employeesReviewStatusQuery = `
  SELECT employee_id,
    MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
    MAX( CASE WHEN status <> 'Closed' THEN review_id ELSE null END) as current_review
  FROM reviews.reviews 
  WHERE employee_id = ANY($1) GROUP BY employee_id
`;

const employee = (obj, args, context) => {
  const conn = getDbConnection('reviews');
  const whConn = getDbConnection('mds');
  console.log('Try here ' + args.id + ' with session ' + context.sessionId);
  if (Object.prototype.hasOwnProperty.call(args, 'id')) {
    console.log('x1');
    return context.cache.get(context.sessionId)
      .then((cData) => {
        console.log('x2');
        const user = (cData) ? cData.user : {};
        console.log(`cData: ${JSON.stringify(cData)}`);
        console.log(`USER: ${JSON.stringify(user)}`);
        if (cData && cData.user && user.id) {
          console.log('x3');
          return operationIsAllowed(args.id, user.id, user.superuser)
            .then((isAllowed) => {
              if (isAllowed) return getEmployee(args.id, conn, whConn, logger);
              throw new Error('Employee query not allowed');
            });
        }
        console.log('x4');
        return Promise.resolve(false);
      });
  }
  if (context.sessionId) {
    return context.cache.get(context.sessionId)
      .then((cData) => {
        // console.log(JSON.stringify(cData));
        const user = (cData) ? cData.user : {};
        if (cData && cData.user && cData.user.id) {
          const emp = loadEmployeeFromCache(cData.user);
          return conn.query(employeesReviewStatusQuery, [[user.id]])
            .then((res) => {
              if (res.rows.length === 0) {
                return Object.assign({}, emp, {
                  current_review: null,
                  last_reviewed: null,
                });
              }
              const r = res.rows[0];
              return Object.assign({}, emp, {
                current_review: r.current_review,
                last_reviewed: (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString(),
              });
            });
        }
        return Promise.resolve(null);
      })
      .catch((err) => {
        logger.error(`Error getting employee: ${err}`);
        return Promise.resolve({ error: `Error getting employee: ${err}` });
      });
  }

  return Promise.resolve(null);
};

module.exports = {
  employee,
  // employees,
};
