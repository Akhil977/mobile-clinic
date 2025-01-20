const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController")
router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage);
router.get('/login',userController.loadLogin)
router.post('/signup',userController.signup)

module.exports=router;