
const preventBackToLogin = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/'); // Redirect to homepage if logged in
    }
    next();
};
module.exports = { preventBackToLogin };