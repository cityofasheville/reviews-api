const getDbConnection = require('../common/db');
const logger = require('../common/logger');
const operationIsAllowed = require('./utilities/operation_is_allowed');
const getCachedUser = require('./utilities/get_cached_user');
const { getReview, getReviews } = require('./utilities/reviews');
const { getEmployee } = require('./utilities/employees_info');
const createReview = require('./utilities/create_review');

const reviews = (obj, args, context) => {
  let verifyAllowed = Promise.resolve(true);

  return getCachedUser(context)
    .then((user) => {
      if (obj.id !== user.id) {
        verifyAllowed = operationIsAllowed(obj.id, user.id, user.superuser);
      }
      return verifyAllowed
        .then((isAllowed) => {
          if (isAllowed) {
            const conn = getDbConnection('reviews');
            const whConn = getDbConnection('mds');
            return getReviews(obj.id, conn, whConn);
          }
          logger.error(`Check-ins query not allowed for user ${user.email}`);
          throw new Error('Check-ins query not allowed');
        });
    });
};

const review = (obj, args, context) => {
  const conn = getDbConnection('reviews');
  const whConn = getDbConnection('mds');

  return getCachedUser(context)
    .then((user) => {
      if (user.id) { // Otherwise it's not a logged-in employee
        // Get based on ID argument
        if (Object.prototype.hasOwnProperty.call(args, 'id') && args.id !== -1) {
          return getReview(args.id, conn, whConn, logger)
            .then((reviewOut) => {
              if (user.id === reviewOut.employee_id) return reviewOut;
              return operationIsAllowed(reviewOut.supervisor_id, user.id, user.superuser)
                .then((isAllowed) => {
                  if (isAllowed) return reviewOut;
                  logger.error(`Check-in query not allowed for user ${user.email}`);
                  throw new Error(`Check-in query not allowed for user ${user.email}`);
                });
            });
        }
        console.log('Should I be here?');
        // Get based on the employee ID
        let employeeId = user.id;
        let verifyAllowed = Promise.resolve(true);
        if (Object.prototype.hasOwnProperty.call(args, 'employee_id')) {
          if (args.employeeId !== employeeId) {
            employeeId = args.employee_id;
            verifyAllowed = operationIsAllowed(employeeId, user.id, user.superuser);
          }
        }

        return verifyAllowed.then((isAllowed) => {
          if (isAllowed) {
            return getEmployee(employeeId, conn, whConn, logger)
              .then((emp) => {
                const currentReview = emp.current_review;
                if (currentReview === null || currentReview === 0) {
                  return createReview(emp, conn);
                }
                return getReview(currentReview, conn, whConn, logger)
                  .catch((err) => {
                    logger.error(`Error retrieving check-in for ${user.email}: ${err}`);
                    throw new Error(err);
                  });
              });
          }
          logger.error(`Check-in query not allowed for user ${user.email}`);
          throw new Error(`Check-in query not allowed for user ${user.email}`);
        });
      } // If we have a valid user
      return Promise.resolve(null);
    });
};

module.exports = {
  review,
  reviews,
};
