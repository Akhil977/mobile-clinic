const User = require('../model/userSchema');

/**
 * Middleware to prevent logged-in users from accessing the login page.
 */
const preventBackToLogin = async (req, res, next) => {
    if (req.session.isLoggedIn) {
        try {
            const user = await User.findById(req.session.user);

            if (!user) {
                req.session.destroy((err) => {
                    if (err) return res.redirect('/login');
                    res.clearCookie('connect.sid');
                    return res.redirect('/login');
                });
            }

            if (user.isBlocked) {
                req.session.destroy((err) => {
                    if (err) return res.redirect('/login');
                    res.clearCookie('connect.sid');
                    return res.redirect('/blockedByAdmin');
                });
            }

            return res.redirect('/'); // Redirect logged-in users to homepage
        } catch (error) {
            console.error("Error in preventBackToLogin middleware:", error);
            req.session.destroy();
            res.clearCookie('connect.sid');
            return res.redirect('/login');
        }
    }
    next(); // Allow access to login page if not logged in
};

/**
 * Middleware to protect routes that require authentication.
 */
const protectRoutes = async (req, res, next) => {
    if (req.session.isLoggedIn) {
        try {
            const user = await User.findById(req.session.user);

            if (!user) {
                req.session.destroy(); // Destroy session if user not found
                return res.redirect('/login'); // Redirect to login
            }

            if (user.isBlocked) {
                req.session.destroy(); // Destroy session if user is blocked
                return res.redirect('/redirect'); // Redirect to your chosen page (e.g., /redirect)
            }

            req.user = user; // Set the user object to req.user for future use
            return next(); // Proceed to the requested route if the user is not blocked
        } catch (error) {
            console.error("Error in protectRoutes middleware:", error);
            req.session.destroy();
            return res.redirect('/login'); // Redirect to login if an error occurs
        }
    }
    // If the user is not logged in, allow access to pages that don't require authentication
    return next(); 
};





const checkBlockedUser = (req, res, next) => {
   
    if (req.session.isLoggedIn) {
        // Assuming req.session.user contains the user IDconsole.log()
        
        User.findById(req.session.user)
            .then(user => {
                if (user && user.isBlocked) {
                    // Destroy session if user is blocked
                    req.session.destroy(err => {
                        if (err) {
                            console.error("Error destroying session:", err);
                        }
                        return res.redirect('/blockedByAdmin'); // Redirect to blocked page
                    });
                } else {
                    // User is not blocked, proceed to the next middleware
                    next();
                }
            })
            .catch(err => {
                console.error("Error fetching user:", err);
                return res.status(500).json({ success: false, message: "Internal server error" });
            });
    } else {
        // If user is not logged in, proceed to the next middleware (if any)
        next();
    }
};

const protectUserProfile = (req, res, next) => {
    if (req.session.isLoggedIn && req.session.user) {
        return next(); 
    }
    return res.redirect('/'); 
};


const preventBackAfterLogout = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '-1');
    next();
};

module.exports = { preventBackToLogin, protectRoutes, preventBackAfterLogout,checkBlockedUser,protectUserProfile  };