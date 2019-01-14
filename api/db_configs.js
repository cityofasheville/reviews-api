module.exports = {
  reviews: {
    db_type: 'pg',
    host: process.env.reviews_host,
    user: process.env.reviews_user,
    password: process.env.reviews_password,
    database: process.env.reviews_database,
    port: 5432,
    ssl: false,
  },
};
