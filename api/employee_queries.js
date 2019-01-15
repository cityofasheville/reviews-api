const getDbConnection = require('../common/db');
const logger = require('../common/logger');
const operationIsAllowed = require('./utilities/operation_is_allowed');
const { loadEmployeeFromCache, getEmployee, getSubordinates } = require('./utilities/employees_info');
const getCachedUser = require('./utilities/get_cached_user');

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
  if (Object.prototype.hasOwnProperty.call(args, 'id')) {
    return getCachedUser(context)
      .then((user) => {
        if (user.id) {
          return operationIsAllowed(args.id, user.id, user.superuser)
            .then((isAllowed) => {
              if (isAllowed) return getEmployee(args.id, conn, whConn, logger);
              throw new Error('Employee query not allowed');
            });
        }
        return Promise.resolve(false);
      });
  }
  if (context.sessionId) {
    return getCachedUser(context)
      .then((user) => {
        if (user.id) {
          const emp = loadEmployeeFromCache(user);
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

const employees = (obj, args, context) => {
  const conn = getDbConnection('reviews');
  const whConn = getDbConnection('mds');
  return getCachedUser(context)
    .then((user) => {
      if (user.id) {
        return operationIsAllowed(obj.id, user.id, user.superuser)
          .then((isAllowed) => {
            if (isAllowed) {
              return getSubordinates(obj.id, conn, whConn, logger);
            }
            throw new Error('Employees query not allowed');
          });
      }
      return Promise.resolve([]);
    });
};

module.exports = {
  employee,
  employees,
};
