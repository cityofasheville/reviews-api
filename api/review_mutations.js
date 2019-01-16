const getDbConnection = require('../common/db');
const logger = require('../common/logger');
const getCachedUser = require('./utilities/get_cached_user');
const { getReview } = require('./utilities/reviews');
const { getEmployee } = require('./utilities/employees_info');
const notify = require('./utilities/notify');

const validateStatusTransition = (review, updatedReview, trueSupervisorId, user) => {
  const r = {
    doSave: false,
    status: review.status,
    transition: null,
    toId: null,
    errorString: null,
  };
  const { status } = r;

  if (Object.prototype.hasOwnProperty.call(updatedReview, 'status')) {
    const newStatus = updatedReview.status;
    if (status !== newStatus) {
      r.doSave = true;
      if (!(newStatus === 'Open' || newStatus === 'Ready' ||
            newStatus === 'Acknowledged' || newStatus === 'Closed')) {
        r.errorString = `Invalid status ${newStatus}`;
      }
      if (status === 'Open') {
        if (newStatus !== 'Ready') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (user.id !== review.supervisor_id) {
          r.errorString = 'Only supervisor may modify check-in in Open status';
        }
      } else if (status === 'Ready') {
        if (newStatus !== 'Open' && newStatus !== 'Acknowledged') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (user.id !== review.employee_id) {
          r.errorString = 'Only employee may modify check-in in Ready status';
        }
      } else if (status === 'Acknowledged') {
        if (newStatus !== 'Open' && newStatus !== 'Closed') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (user.id !== review.supervisor_id) {
          r.errorString = 'Only supervisor may modify check-in in Acknowledged status';
        }
      } else if (status === 'Closed') {
        r.errorString = 'Status transition from Closed status is not allowed';
      }

      if (status === 'Open') {
        r.transition = 'Ready';
        r.toId = review.employee_id;
      } else if (status === 'Ready') {
        if (newStatus === 'Open') r.transition = 'Reopen';
        else r.transition = 'Acknowledged';
        r.toId = review.supervisor_id;
      } else if (status === 'Acknowledged') {
        if (newStatus === 'Closed') r.transition = 'Closed';
        else r.transition = 'ReopenBySup';
        r.toId = review.employee_id;
      }
      r.status = newStatus;
    }
  }
  return r;
};

const updateReview = (root, args, context) => {
  const conn = getDbConnection('reviews');
  const whConn = getDbConnection('mds');
  const t1 = new Date();
  const currentDate = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;
  const reviewId = args.id;
  const reviewInput = args.review;
  let review;
  let doSave = false;
  let periodStart;
  const periodEnd = currentDate;
  let statusDate;
  let employeeInfo;
  let transition = null;
  let toId = null; // We'll need for looking up email address.
  let toEmail = null;
  let supervisorId;
  let status;
  let supervisorChangeFlag = false; // Flag if a possible supervisor takeover.

  logger.info(`Updating review ${reviewId}`);

  return getCachedUser(context)
    .then((user) => {
      if (user.email === null) {
        // Probably just a need to refresh the auth token
        throw new Error('User unauthenticated. '
        + 'This may simply be a token refresh problem. '
        + 'Try saving again.');
      }
      return conn.query('SELECT * from reviews.reviews WHERE review_id = $1', [reviewId])
        .then((result) => {
          [review] = result.rows;
          ({ status } = review);
          periodStart = review.period_start;
          statusDate = review.status_date;

          // If the user is neither employee or supervisor, there may be a supervisor change.
          if (user.id !== review.employee_id
            && user.id !== review.supervisor_id) {
            supervisorChangeFlag = true;
          }
          return getEmployee(review.employee_id, conn, whConn, logger);
        })
        .then((e) => {
          employeeInfo = e;
          supervisorId = review.supervisor_id;

          if (supervisorChangeFlag) {
            // Supervisor has changed or we have unauthorized save
            if (user.id === employeeInfo.supervisor_id) {
              // Reset the supervisor in the review, there has been a change.
              logger.warn(`Changing the supervisor of this review to current user ${user.email}`);
              supervisorId = employeeInfo.supervisor_id;
            } else {
              logger.error(`Only the supervisor or employee can modify a check-in, ${user.email}`);
              throw new Error(`Only the supervisor or employee can modify a check-in, ${user.email}`);
            }
          }

          // Check that the status transition is OK
          if (Object.prototype.hasOwnProperty.call(reviewInput, 'status')) {
            const t = validateStatusTransition(review, reviewInput, supervisorId, user);
            if (t.errorString !== null) {
              logger.error(`Check-in update error for user ${user.email}: ${t.errorString}`);
              throw new Error(t.errorString);
            }
            ({ status } = t);
            ({ doSave } = t);
            ({ transition } = t);
            ({ toId } = t);
            if (transition !== null) statusDate = currentDate;
          }
          if ((reviewInput.questions !== null && reviewInput.questions.length > 0) ||
              (reviewInput.responses !== null && reviewInput.responses.length > 0)) {
            doSave = true;
          }
          if (!doSave) return Promise.resolve({ error: false });

          // Now set up and run the updates
          const queries = [];

          // Questions
          if (reviewInput.questions !== null && reviewInput.questions.length > 0) {
            reviewInput.questions.forEach((q) => {
              const update = 'UPDATE reviews.questions SET answer = $1 WHERE question_id = $2;';
              queries.push(conn.query(update, [q.answer, q.id]));
            });
          }

          // Responses
          if (reviewInput.responses !== null && reviewInput.responses.length > 0) {
            reviewInput.responses.forEach((r) => {
              if (r.question_id === null) {
                const update = `UPDATE reviews.responses SET response = $1
                                HERE review_id = $2;`;
                queries.push(conn.query(update, [r.Response, reviewId]));
              } else {
                const update = `UPDATE reviews.responses SET response = $1 
                                WHERE (review_id = $2 AND question_id = $3);`;
                queries.push(conn.query(update, [r.Response, reviewId, r.question_id]));
              }
            });
          }

          // Review
          const update = 'UPDATE reviews.reviews SET status = $2, status_date = $3, '
          + 'period_start = $4, period_end = $5, supervisor_id = $6 WHERE review_id = $1';
          const parameters = [reviewId, status, statusDate, periodStart, periodEnd, supervisorId];
          queries.push(conn.query(update, parameters));

          return Promise.all(queries);
        })
        .then(() => getReview(args.id, conn, whConn, logger))
        .then((updatedReview) => {
          if (transition === null) return Promise.resolve(updatedReview);
          // https://medium.com/@yashoda.charith10/sending-emails-using-aws-ses-nodejs-460b8cc6d0d5

          // We have a status transition - trigger a notification.
          toEmail = (toId === employeeInfo.id) ? employeeInfo.email : employeeInfo.supervisor_email;
          return notify(transition, process.env.notification_email_address, toEmail)
            .then(() => Promise.resolve(updatedReview));
        })
    })
    .catch((err) => {
      logger.error(`Error updating check-in: ${err}`);
      throw new Error(`Error at check-in update end: ${err}`);
    });
};

module.exports = {
  updateReview,
};
