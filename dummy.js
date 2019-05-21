var auth = require('./auth');
var toekn= '';

// Get an access token for the app.
auth.getAccessToken().then(function (token) {
    console.log('first'+token);
    // Get all of the users in the tenant.
    TokenVar=token;
    console.log('2nd'+TokenVar);
  }, function (error) {
    console.error('>>> Error getting access token: ' + error);
  });