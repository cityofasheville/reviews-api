const getDbConnection = require('../../common/db');

const isOperationAllowed = (targetId, myId, isSuperuser) => {
  if (myId === undefined) return Promise.resolve(false);
  if (isSuperuser || myId === targetId) {
    return Promise.resolve(true);
  }
  const query = `
    select case WHEN count(emp_id) = 1 then true else false end as allowed from (
      WITH RECURSIVE subordinates AS (
        SELECT emp_id, employee, sup_id, 0 depth
        FROM internal.pr_employee_info
        WHERE emp_id = $1
        UNION
        SELECT
        e.emp_id, e.employee, e.sup_id, s.depth + 1 depth
        FROM internal.pr_employee_info e
        INNER JOIN subordinates s ON s.emp_id = e.sup_id
        WHERE depth < 10
      ) SELECT * FROM subordinates
    ) AS A where emp_id = $2
  `;
  const conn = getDbConnection('mds');
  return conn.query(query, [myId, targetId])
    .then((result) => {
      if (result.rows && result.rows.length > 0 && result.rows[0].allowed) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });
};

module.exports = isOperationAllowed;
