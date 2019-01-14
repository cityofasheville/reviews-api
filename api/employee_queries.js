const getDbConnection = require('../common/db');
const { isReviewable, notReviewableReason } = require('./reviewable');

const loadEmployee = (e) => {
  const employee = {
    id: e.id,
    active: e.active,
    ft_status: e.ft_status,
    name: e.name,
    email: e.email,
    position: e.position,
    department: e.department,
    department_id: e.department_id,
    division: e.division,
    division_id: e.division_id,
    current_review: null,
    last_reviewed: null,
    reviewable: isReviewable(e),
    review_by: null,
    not_reviewable_reason: notReviewableReason(e),
    supervisor_id: e.supervisor_id,
    supervisor_name: e.supervisor_name,
    supervisor_email: e.supervisor_email,
    employees: null,
    reviews: null,
  };
  return employee;
};

const employeesReviewStatusQuery = `
  SELECT employee_id,
    MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
    MAX( CASE WHEN status <> 'Closed' THEN review_id ELSE null END) as current_review
  FROM reviews.reviews 
  WHERE employee_id = ANY($1) GROUP BY employee_id
`;

const employee = (obj, args, context) => {
  const conn = getDbConnection('reviews');
  if (Object.prototype.hasOwnProperty.call(args, 'id')) {
    // return operationIsAllowed(args.id, context)
    // .then(isAllowed => {
    //   if (isAllowed) return getEmployee(args.id, conn, context.whPool, context.logger);
    //   throw new Error('Employee query not allowed');
    // });
    return Promise.resolve(null);
  }
  if (context.sessionId) {
    return context.cache.get(context.sessionId)
      .then((cData) => {
        const user = (cData) ? cData.user : {};
        if (cData && cData.user && cData.user.id) {
          console.log(`Employee id is ${cData.user.id}`);
          const employee = loadEmployee(cData.user);
          return conn.query(employeesReviewStatusQuery, [[user.id]])
            .then((res) => {
              if (res.rows.length === 0) {
                return Object.assign({}, employee, {
                  current_review: null,
                  last_reviewed: null,
                });
              }
              const r = res.rows[0];
              return Object.assign({}, employee, {
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

  // if (context.email !== null) {
  //   if (context.employee_id !== null) {
  //     return getEmployee(context.employee_id, conn, context.whPool, context.logger);
  //   }
  // }
  // throw new Error('In employee query - employee_id not set');
};

module.exports = {
  employee,
  // employees,
};
