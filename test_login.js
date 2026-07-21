const { loginUser } = require('./src/lib/services/auth-service');
loginUser({ email: 'student@fpt.edu.vn', password: 'password123' })
  .then(console.log)
  .catch(console.error);
