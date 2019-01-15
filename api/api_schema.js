const schema = `
type Book {
  title: String
  author: String
  secret: String
}

type Employee {
  id: Int!
  active: Boolean!
  name: String!
  email: String
  position: String
  department: String
  department_id: String
  division: String
  division_id: String
  current_review: Int
  last_reviewed: String
  reviewable: Boolean
  not_reviewable_reason: String
  review_by: String
  supervisor_id: Int!
  supervisor_name: String
  supervisor_email: String
  employees: [Employee]
  reviews: [Review]
}

type Review {
  id: Int!
  status: String!
  status_date: String
  supervisor_id: Int!
  employee_id: Int!
  position: String
  previousReviewDate: String
  periodStart: String
  periodEnd: String
  reviewer_name: String
  employee_name: String
  questions: [Question]
  responses: [Response]
}

type Question {
  id: Int!
  type: String!
  question: String!
  answer: String
  required: Boolean
}

type Response {
  question_id: Int
  review_id: Int!
  Response: String
}

extend type Query {
  "This is documentation"
  employee ( id: Int ): Employee
  review ( id: Int, employee_id: Int ): Review
}

`;
module.exports = schema;

