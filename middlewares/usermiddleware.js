const User = require("../model/userSchema");

const preventBackToLogin = async (req, res, next) => {
    if (req.session.isLoggedIn) {
        // If the user is logged in and not blocked, redirect to homepage/dashboard
        const user = await User.findById(req.session.user);

        if (!user) {
            return res.redirect('/login'); // Redirect to login if user is not found
        }

        if (user.isBlocked) {
            // If user is blocked, redirect to the blocked page
            return res.redirect('/blockedByAdmin');
        }

        return res.redirect('/'); // Redirect to homepage or dashboard if already logged in
    }

    // Continue to the next middleware if not logged in
    next();
};

module.exports = { preventBackToLogin };