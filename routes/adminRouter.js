const express = require("express");
const router = express.Router();
const adminController = require("../controller/admin/adminController");
const multer = require('multer');
const customerController = require("../controller/admin/coustomerController");
const categoryController = require('../controller/admin/categoryController');
const adminAuth = require("../middlewares/adminmiddleware");
const productController= require("../controller/admin/productController");


// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, imageDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix =
//       Date.now() + '-' + file.originalname.replace(/\s+/g, '-'); // Replace spaces with dashes
//     cb(null, uniqueSuffix);
//   },
// });

// const uploads = multer({
//   storage: storage,
//   limits: {
//     fileSize: 2 * 1024 * 1024 * 4, //2mb
//     files: 6, // Maximum number of files
//     fieldSize: 10 * 1024 * 1024,
//   },
// });



// /////////////////////////////////////////////////////////////////////////////////////
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
      fileSize: 5 * 1024 * 1024 // 5MB file 
  }
})





const path = require('path');

const imageDir = path.join(__dirname,"../public/uploads");

// Admin Login and Dashboard
router.get('/login', adminAuth.adminAuth, adminController.loadlogin);
router.post("/login", adminController.login);
router.get("/", adminAuth.adminCheck, adminController.loadDashboard);
router.get("/logout-admin", adminAuth.adminCheck, adminController.adminLogout);

// User Management
router.get("/userManagement", adminAuth.adminCheck, customerController.customerInfo);
router.post('/blockCustomer', adminAuth.adminCheck, customerController.blockUnblockCustomer);

// Category Management'/admin/addCategory'

router.get('/category', adminAuth.adminCheck, categoryController.categoryInfo);
router.post('/addCategory', adminAuth.adminCheck, categoryController.addCategory);
router.post('/addCategoryOffer',adminAuth.adminCheck,categoryController.addCategoryOffer);
  router.post('/removeCategoryOffer',adminAuth.adminCheck,categoryController.removeCategoryOffer);
  router.get('/listCategory', adminAuth.adminCheck, categoryController.getListCategory);
  router.get('/unlistCategory', adminAuth.adminCheck, categoryController.getUnlistCategory);
  router.get('/editCategory', adminAuth.adminCheck, categoryController.getEditCategory);
  router.post('/editCategory/:id', adminAuth.adminCheck, categoryController.editCategory)

router.get("/product", adminAuth.adminCheck, productController.getProductAddPage)
router.post("/addProducts", adminAuth.adminCheck, uploads.array("images", 4), productController.addProducts)
router.get('/products', adminAuth.adminCheck, productController.getAllProducts)
router.patch('/toggle-list/:id', adminAuth.adminCheck, productController.toggleProductList)
router.patch('/toggleCategory/:id', adminAuth.adminCheck, categoryController.toggleCategory)

router.get('/categories/edit/:id',  categoryController.getEditCategory);
router.put('/categories/update/:id', categoryController.updateCategory);


router.get("/editProduct",adminAuth.adminCheck,productController.getEditProduct)

router.post('/editProduct/:id', uploads.array('images', 4), productController.editProduct);


router.post('/deleteImage', productController.deleteSingleImage);











// router.get("/editProduct",adminAuth.adminCheck,productController.getEditProduct);
// router.post('/update-product/:id',adminAuth.adminCheck,uploads.array("images",4),productController.updateProduct);
// router.post("/deleteImage",adminAuth.adminCheck,productController.deleteSingleImage)








// router.get('/editproduct/:id', productController.productController.getEditProduct)



// // Update product
// router.post(
//   '/update-product/:id', 
//   upload.array('newImages', 3), // Allow up to 3 new images
//   productController.productController.updateProduct
// );

// // Delete product image
// router.delete('/delete-product-image/:productId/:imageId', productController.productController.deleteProductImage);

module.exports = router