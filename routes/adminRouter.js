const express = require("express");
const router = express.Router();
const adminController = require("../controller/admin/adminController");
const multer = require('multer');
const customerController = require("../controller/admin/coustomerController");
const categoryController = require('../controller/admin/categoryController');
const adminAuth = require("../middlewares/adminmiddleware");
const productController= require("../controller/admin/productController");
const orderController = require("../controller/admin/adminOrderController");
const brandController = require("../controller/admin/BrandController")
const CouponController = require("../controller/admin/couponController")
const salesReportController=require("../controller/admin/salereportController")
const path = require('path');

const imageDir = path.join(__dirname,"../public/uploads");


router.get('/login', adminAuth.adminAuth, adminController.loadlogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.adminCheck, adminController.renderDashboardPage);
router.get("/api/dashboard", adminAuth.adminCheck, adminController.loadDashboardData)

router.get("/logout-admin", adminAuth.adminCheck, adminController.adminLogout);

router.get("/userManagement", adminAuth.adminCheck, customerController.customerInfo);
router.post('/blockCustomer', adminAuth.adminCheck, customerController.blockUnblockCustomer);



router.get('/category', adminAuth.adminCheck, categoryController.categoryInfo);

router.post('/addCategory', adminAuth.adminCheck, categoryController.addCategory);
router.post("/addCategoryOffer",adminAuth.adminCheck,categoryController.addCategoryOffers)
router.post("/removeCategoryOffer", adminAuth.adminCheck, categoryController.removeCategoryOffer);

  router.get('/listCategory', adminAuth.adminCheck, categoryController.getListCategory);
  router.get('/unlistCategory', adminAuth.adminCheck, categoryController.getUnlistCategory);
  router.get('/editCategory', adminAuth.adminCheck, categoryController.getEditCategory);
  
router.put('/categories/update/:id', categoryController.updateCategory);
  



router.get('/brand', adminAuth.adminCheck, brandController.brandInfo);
router.post('/addBrand', adminAuth.adminCheck, brandController.addBrand);

router.get('/blockBrand', adminAuth.adminCheck, brandController.getUnlistBrand);
router.get('/unblockBrand', adminAuth.adminCheck, brandController.getListBrand);
router.get('/editBrand', adminAuth.adminCheck, brandController.getEditBrand);

router.put('/brands/update/:id', brandController.updateBrand);

// Coupon Routes
router.get('/coupon', adminAuth.adminCheck, CouponController.getCoupon);
router.post('/couponadd', adminAuth.adminCheck, CouponController.addCoupon);
router.get('/getCoupon/:id', adminAuth.adminCheck, CouponController.getCouponById);
router.put('/editCoupon/:id', adminAuth.adminCheck, CouponController.editCoupon);
router.patch('/toggleCouponStatus/:id', adminAuth.adminCheck, CouponController.toggleCouponStatus);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../public/uploads/products'))
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
      cb(null, true)
  } else {
      cb(new Error('Not an image! Please upload an image.'), false)
  }
}

const uploads = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
      fileSize: 10 * 1024 * 1024, 
      files: 10 
  }
})

router.get("/product", adminAuth.adminCheck, productController.getProductAddPage)
router.post("/addProducts", adminAuth.adminCheck, uploads.array("images", 10), productController.addProducts)
router.get('/products', adminAuth.adminCheck, productController.getAllProducts)
router.patch('/toggle-list/:id', adminAuth.adminCheck, productController.toggleProductList)
router.patch('/toggleCategory/:id', adminAuth.adminCheck, categoryController.toggleCategory)




router.get("/editProduct",adminAuth.adminCheck,productController.getEditProduct)

router.post('/editProduct/:id', uploads.array('images', 10), productController.editProduct);


router.post('/deleteImage', productController.deleteSingleImage);

router.get('/view-order',orderController.viewOrders)
router.post("/addProductOffer",productController.addProductOffers)
router.post('/removeProductOffer',productController.deleteOffers)


router.patch("/update-order-status",orderController.updateStatus)
router.get("/orderDetails",orderController.showOrderDetails)


//sale report

//sales report management
router.get('/sales-report',salesReportController.getSalesReport);
router.get('/salesReportPDF/pdf', salesReportController.getSalesReportPDF);  

module.exports = router