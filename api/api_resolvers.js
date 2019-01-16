const { employee, employees } = require('./employee_queries');
const {
  review, reviews, questions, responses,
} = require('./review_queries');

const resolvers = {
  Query: {
    employee,
    review,
  },
  Employee: {
    employees,
    reviews,
  },
  Review: {
    questions,
    responses,
  },
};
module.exports = resolvers;
