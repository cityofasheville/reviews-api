const { isReviewable, notReviewableReason } = require('./reviewable');

const employeesReviewStatusQuery = `
  SELECT employee_id,
    MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
    MAX( CASE WHEN status <> 'Closed' THEN review_id ELSE null END) as current_review
  FROM reviews.reviews 
  WHERE employee_id = ANY($1) GROUP BY employee_id
`;

const loadEmployeeFromTable = (e) => {
  const employee = {
    id: e.emp_id,
    active: e.active,
    ft_status: e.ft_status,
    name: e.employee,
    email: e.emp_email,
    position: e.position,
    department: e.department,
    department_id: e.dept_id,
    division: e.division,
    division_id: e.div_id,
    current_review: null,
    last_reviewed: null,
    reviewable: isReviewable(e, 'emp_email'),
    review_by: null,
    not_reviewable_reason: notReviewableReason(e, 'emp_email'),
    supervisor_id: e.sup_id,
    supervisor_name: e.supervisor,
    supervisor_email: e.sup_email,
    employees: null,
    reviews: null,
  };
  return employee;
};

const loadEmployeeFromCache = (e) => {
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
    reviewable: isReviewable(e, 'email'),
    review_by: null,
    not_reviewable_reason: notReviewableReason(e, 'email'),
    supervisor_id: e.supervisor_id,
    supervisor_name: e.supervisor_name,
    supervisor_email: e.supervisor_email,
    employees: null,
    reviews: null,
  };
  return employee;
};

const getEmployee = (id, pool, whPool, logger) => {
  return whPool.query('select * from internal.employees_main_view where emp_id = $1', [id])
    .then((result) => {
      const employee = loadEmployeeFromTable(result.rows[0]);
      return pool.query(employeesReviewStatusQuery, [[id]])
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
    })
    .catch((err) => {
      logger.error(`Error getting employee ${err}`);
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
};

const getSubordinates = (id, pool, whPool, logger) => {
  const employeesById = {};
  const eIds = [];
  return whPool.query('select * from internal.employees_main_view where sup_id = $1', [id])
    .then((result) => {
      result.rows.filter((e) => {
        return e.active === 'A';
      }).forEach((e) => {
        eIds.push(e.emp_id);
        employeesById[e.emp_id] = loadEmployeeFromTable(e);
      });
      return pool.query(employeesReviewStatusQuery, [eIds])
        .then((res) => {
          res.rows.forEach((r) => {
            const e = employeesById[r.employee_id];
            e.current_review = r.current_review;
            e.last_reviewed = (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString();
          });
          const final = eIds.map((eId) => {
            return employeesById[eId];
          });
          console.log(JSON.stringify(final));
          return final;
        });
    });
};

module.exports = {
  getEmployee,
  getSubordinates,
  loadEmployeeFromTable,
  loadEmployeeFromCache,
};
