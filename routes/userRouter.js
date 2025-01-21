const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const passport = require("../config/passport");
router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage);
router.get('/login',userController.loadLogin)
router.post('/signup',userController.signup)

router.get('/otp',(req,res)=>{
    res.render('otp');
})
router.post('/verifyotp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{
    res.redirect('/')
});

module.exports=router;