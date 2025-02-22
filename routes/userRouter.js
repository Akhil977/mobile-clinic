const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const passport = require("../config/passport");
const productController = require("../controller/user/productController");
const { protectUserProfile,preventBackToLogin, protectRoutes, preventBackAfterLogout,checkBlockedUser } = require("../middlewares/usermiddleware");
const profileCotrller = require("../controller/user/profileCotrller")
const cartController = require("../controller/user/cartController")
const checkout = require("../controller/user/orderController")
const whishlist = require("../controller/user/wishlistController")
const wallet = require("../controller/user/walletController")
const razorpayController = require("../controller/user/razorpayController")


// Razorpay routes
router.post('/razorpay/create-order',razorpayController.createOrder);
router.post('/razorpay/verify-payment',razorpayController.verifyPayment);

router.use(preventBackAfterLogout);


router.get("/pageNotFound",checkBlockedUser,userController.pageNotFound);
router.get("/",checkBlockedUser,userController.loadHomepage);
router.get('/login', preventBackToLogin, userController.loadLogin);
router.post('/signup', userController.signup);

router.get('/otp', (req, res) => {
    res.render('otp');
});

router.post('/verifyotp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    if (req.user.isBlocked) {
        req.session.destroy(); 
        return res.redirect('/blockedByAdmin');
    }

    req.session.isLoggedIn = true; 
    req.session.user = req.user._id;
    res.redirect('/'); 
});


router.post("/log", userController.log);


router.get("/logout", (req, res) => {
    delete req.session.isLoggedIn;
    delete req.session.user ;
  
        res.redirect('/login');
    
});


router.get('/productdetail',checkBlockedUser, productController.productDetails);
router.get('/product-detail',checkBlockedUser, productController.productDetails);



router.get("/forgot-password",profileCotrller.getForgotPasspage)
router.post("/verify-email",profileCotrller.forgotEmailValid)
router.get("/forgot-otp",profileCotrller.getforgototp)

router.post("/verify-otp",profileCotrller.validatingotp)
router.get("/reset-password",profileCotrller.getRestPassword)
router.post('/reset-password',profileCotrller.restPassword)
router.get("/user-address",profileCotrller.getaddress)
router.get('/add-address',profileCotrller. getaddaddress)
router.get("/editaddress",profileCotrller.geteditaddress)
router.post('/editaddress/:id',profileCotrller.posteditaddress);
router.post("/addaddress",profileCotrller. addaddress)
router.delete("/deleteaddress/:id",profileCotrller.deleteaddress)

router.get("/profile",protectUserProfile,profileCotrller.getprofile)
router.patch("/profile",profileCotrller.updateProfile)

router.post("/updatePassword",profileCotrller.checkOldPassword)
router.post("/update-password",profileCotrller. updatePassword)




//cart 
router.get("/carthandler",cartController.addcart)
router.post('/removecart', cartController.deleteitem)
router.delete('/removecart', cartController.deleteitem)
router.post('/updatecart', cartController.updateCartQuantity)

router.get("/category",productController.getProduct)

router.get("/cart",cartController.getCart)

///////////checkout

router.get("/checkout", protectUserProfile, checkout.getcheckout)
router.get("/order/buy-now", protectUserProfile, checkout.getdirectcheackout)
//router.post("/placeOrder", protectUserProfile, checkout.placeOrder);
 router.post("/placeBuyNowOrder", protectUserProfile, checkout.placeOrder)
router.patch('/apply-coupon', protectUserProfile, checkout.applyCoupon);
router.post("/add-checkout-address", protectUserProfile, checkout.addAddress)
router.post("/edit-checkout-address", protectUserProfile, checkout.editAddress)

/////////////ORDERS

router.get("/user-orders", protectRoutes, checkout.loadUserOrders);
router.get("/order-details", protectRoutes, checkout.loadOrderDetails);
router.post("/orders/cancel", protectRoutes, checkout.cancelOrder);
router.post("/orders/return", protectRoutes, checkout.returnOrder);

// Wishlist routes
router.get("/checkWishlist", whishlist.checkWishlist);
router.post("/addWishlist", whishlist.addwishlist);
router.post("/removeFromWishlist", whishlist.removeFromWishlist);
router.get("/wishlist", whishlist.getWishlist);

//Wallet
router.get("/user-wallet",wallet.getWallet)
router.post("/add-wallet-money",wallet.addmoney)

// Blocked User Page
router.get('/blockedByAdmin', userController.adminBlocked);



module.exports = router;
