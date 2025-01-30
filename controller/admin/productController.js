
const product = require('../../model/productShema')
const User = require("../../model/userSchema")
const Category = require('../../model/categorySchema')
const fs = require("fs")
const path = require('path')
const sharp = require('sharp')
const { addCategory } = require('./categoryController')
const Product = require('../../model/productShema')

const getProductAddPage = async (req, res) => {
    try {
 
       const category = await Category.find({ isListed: true })
       res.render('product-add', { cat: category })
 
    } catch (error) {
       res.redirect('/pageerror')
    }
 }
 
 
 const addProducts = async (req, res) => {
   try {
       const products = req.body;

       // Strip commas and convert to float
       const regularPrice = parseFloat(products.regularPrice.replace(/,/g, ''));
       const salePrice = parseFloat(products.salePrice.replace(/,/g, ''));

       // Log to confirm prices are correct
       console.log("Parsed Regular Price:", regularPrice);
       console.log("Parsed Sale Price:", salePrice);

       if (isNaN(regularPrice) || isNaN(salePrice)) {
           return res.status(400).json({ message: "Invalid price format" });
       }
       
       const productExists = await product.findOne({
           productName: products.productName // Fixed typo (products.productsName → products.productName)
       });

       if (!productExists) {
           const images = [];
           if (req.files && req.files.length > 0) {
               for (let i = 0; i < req.files.length; i++) {
                   const originalImagePath = req.files[i].path;
                   const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);

                   await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);

                   images.push(req.files[i].filename);
               }
           }

           const categoryId = await Category.findOne({ name: products.category });
           if (!categoryId) {
               return res.status(400).json({ message: "Category not found" });
           }

           const newProduct = new product({
               productName: products.productName,
               description: products.description,
               category: categoryId._id,
               regularPrice: regularPrice,
               discountPrice: products.discountPrice,
               salePrice: salePrice,
               createdAt: Date.now(),
               productImages: images,
               isListed: products.isListed,
               quantity: products.quantity,
               size: products.size,
               brand: products.brand || "Unknown", // Added brand field with default "Unknown"
               status: "available"
           });

           await newProduct.save();
           return res.redirect('/admin');
       } else {
           const category = await Category.find({ isListed: true });
           return res.render('product-add', { cat: category, message: "Product already exists" });
       }
   } catch (error) {
       console.log("Error adding product", error);
       res.redirect('/pageerror');
   }
};

 
 const getAllProducts = async (req, res) => {
    try {
 
       const search = req.query.search || "";
       const page = Math.max(1, parseInt(req.query.page)) || 1;
       const limit = 5
 
 
       const productData = await Product.find({
          $or: [
             { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
          ]
       })
          .limit(limit)
          .skip((page - 1) * limit)
          .populate('category') // Ensure this matches the schema's `ref` field
          .exec();
 
 
       const count = await Product.find({
          $or: [
             { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
          ]
       }).countDocuments();
 
 
       const category = await Category.find({ isListed: true });
 
 
       res.render('products', {
          data: productData,
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          cat: category,
          searchTerm: search
       });
 
    } catch (error) {
       console.error("Error in getAllProducts:", error);
       res.redirect('/pageerror');
    }
 };
 
 const toggleProductList = async (req, res) => {
    try {
       const productId = req.params.id;
       const { isListed } = req.body;
 
       // Find the product
       const productToToggle = await Product.findById(productId);
 
       if (!productToToggle) {
          return res.status(404).json({
             error: 'Product not found',
             success: false
          });
       }
 
 
       productToToggle.isListed = isListed;
       await productToToggle.save();
 
 
       res.json({
          message: `Product ${isListed ? 'listed' : 'unlisted'} successfully`,
          isListed: productToToggle.isListed,
          success: true
       });
 
    } catch (error) {
       console.error("Error toggling product list status:", error);
       res.status(500).json({
          error: 'Failed to toggle product status',
          success: false
       });
    }
 };
 
 const getEditProduct= async(req,res)=>{
    try {
        const id  =req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await  Category.find({});
        res.render("edit-product",{
            product:product,
            cat:category

        })
        
    } catch (error) {
        console.log("geteditpage rendeing error")
    }
 }

 
 module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    toggleProductList,
    getEditProduct
   
    
 }                                             