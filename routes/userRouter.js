const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const passport = require("../config/passport");
const auth= require("../middlewares/usermiddleware")
const productController=require("../controller/user/productController")
router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage);
router.get('/login',auth.preventBackToLogin,userController.loadLogin)
router.post('/signup',userController.signup)

router.get('/otp',(req,res)=>{
    res.render('otp');
})
router.post('/verifyotp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    // Check if user is blocked
    if (req.user.isBlocked) {
        return res.redirect('/blockedByAdmin'); // Redirect if the user is blocked
    }
    
    req.session.isLoggedIn = true; // Set logged-in state
    req.session.user = req.user._id; // Store user ID in session if needed
    res.redirect('/'); // Redirect to homepage if not blocked
});
// router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{
//     res.redirect('/')
// });
router.post("/log",userController.log);
router.get("/logout",userController.logout);







router.get('/productdetail',productController.productDetails)
router.get('/product-detail',productController.productDetails)



// for blocked user 
router.get('/blockedByAdmin',userController.adminBlocked);

module.exports=router;