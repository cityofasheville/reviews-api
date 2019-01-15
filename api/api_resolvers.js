const { employee, employees } = require('./employee_queries');
const { review, reviews } = require('./review_queries');

const resolvers = {
  Query: {
    employee,
    review,
  },
  Employee: {
    employees,
    reviews,
  },
};
module.exports = resolvers;
