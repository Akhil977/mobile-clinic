const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const passport = require("../config/passport");
const productController = require("../controller/user/productController");
const { preventBackToLogin, protectRoutes, preventBackAfterLogout,checkBlockedUser } = require("../middlewares/usermiddleware");

// Apply preventBackAfterLogout globally to prevent users from going back after logout
router.use(preventBackAfterLogout);

// Public Routes
router.get("/pageNotFound",checkBlockedUser,userController.pageNotFound);
router.get("/",checkBlockedUser,userController.loadHomepage);
router.get('/login', preventBackToLogin, userController.loadLogin);
router.post('/signup', userController.signup);

router.get('/otp', (req, res) => {
    res.render('otp');
});

router.post('/verifyotp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);

// Google Authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    if (req.user.isBlocked) {
        req.session.destroy(); // Destroy session if user is blocked
        return res.redirect('/blockedByAdmin');
    }

    req.session.isLoggedIn = true; // Set session logged-in state
    req.session.user = req.user._id; // Store user ID in session
    res.redirect('/'); // Redirect to homepage
});

// User Login
router.post("/log", userController.log);

// User Logout (Destroy session and prevent back navigation)
router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Protected Routes (Only logged-in users can access)
// router.get('/dashboard', protectRoutes, userController.loadDashboard);
router.get('/productdetail',checkBlockedUser, productController.productDetails);
router.get('/product-detail',checkBlockedUser, productController.productDetails);

// Blocked User Page
router.get('/blockedByAdmin', userController.adminBlocked);

module.exports = router;
