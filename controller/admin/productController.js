const product = require('../../model/productShema')
const User = require("../../model/userSchema")
const Category = require('../../model/categorySchema')
const fs = require("fs")
const path = require('path')
const sharp = require('sharp')
const { addCategory } = require('./categoryController')
const Product = require('../../model/productShema')
const BRAND = require("../../model/brandschema")
const mongoose = require('mongoose');

const getProductAddPage = async (req, res) => {
    try {
 
       const category = await Category.find({})
       const Brand = await BRAND.find({});
       res.render('product-add', { cat: category,Brand })
 
    } catch (error) {
       res.redirect('/pageerror')
    }
 }
 
 
 const addProducts = async (req, res) => {
   try {
       const products = req.body;

       // Check for exactly 3 images
       if (!req.files || req.files.length !== 3) {
           return res.status(400).json({ 
             success: false,
             message: "Exactly 3 product images are required" 
           });
       }

       // Validate quantity
       const quantity = parseInt(products.quantity);
       if (isNaN(quantity) || quantity < 0) {
           return res.status(400).json({
               success: false,
               message: "Quantity must be a positive number"
           });
       }

       // Strip commas and convert to float
       const regularPrice = parseFloat(products.regularPrice.replace(/,/g, ''));
       const salePrice = parseFloat(products.salePrice.replace(/,/g, ''));

       // Log to confirm prices are correct
       console.log("Parsed Regular Price:", regularPrice);
       console.log("Parsed Sale Price:", salePrice);

       if (isNaN(regularPrice) || isNaN(salePrice)) {
           return res.status(400).json({ success: false, message: "Invalid price format" });
       }
    
       if (regularPrice < 0) {
           return res.status(400).json({ success: false, message: "Regular price cannot be negative" });
       }
    
       if (salePrice < 0) {
           return res.status(400).json({ success: false, message: "Sale price cannot be negative" });
       }
    
       if (salePrice >= regularPrice) {
           return res.status(400).json({ success: false, message: "Sale price must be smaller than the regular price" });
       }
       
       const productExists = await product.findOne({
           productName: products.productName
       });

       if (productExists) {
           return res.status(400).json({ 
               success: false, 
               message: "Product already exists" 
           });
       }

       const images = [];
       // Process and resize all images
       for (const file of req.files) {
           const originalImagePath = file.path;
           const resizedImagePath = path.join("public", "uploads", "product-images", file.filename);

           await sharp(originalImagePath)
               .resize({ width: 440, height: 440 })
               .toFile(resizedImagePath);

           images.push(file.filename);
       }

       const categoryId = await Category.findOne({ name: products.category });
       if (!categoryId) {
           return res.status(400).json({ 
               success: false, 
               message: "Category not found" 
           });
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
           brand: products.brand || "Unknown",
           status: "available"
       });

       await newProduct.save();
       return res.status(200).json({ 
           success: true, 
           message: "Product added successfully" 
       });
   } catch (error) {
       console.error("Error in addProducts:", error);
       return res.status(500).json({ 
           success: false, 
           message: "Internal server error" 
       });
   }
}
 
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
 const addProductOffers = async (req, res) => {
  try {
    const { productId, discountPercentage, expiryDate } = req.body;
    
    // Validate input
    if (!productId || !discountPercentage || !expiryDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Validate discount percentage
    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid discount percentage" 
      });
    }

    // Check if category exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Category not found" 
      });
    }
    console.log(discount)

    // Update category with offer
    const offerproduct = await Product.updateOne(
      { _id: productId },
      { 
        $set: { 
          productOffers:discount, 
          expireOn: new Date(expiryDate) 
        } 
      }
    );

    if (offerproduct.modifiedCount > 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Offer added to product successfully" 
      });
    } else {
      return res.status(200).json({ 
        success: false, 
        message: "No changes made to product" 
      });
    }
  } catch (error) {
    console.error('Error adding product offer:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
};

const deleteOffers=async(req,res)=>{
  const {productId}=req.body;

  const deleteProduct = await Product.updateOne(
    {  _id: new mongoose.Types.ObjectId(productId)},
    { 
      $unset: { 
        productOffers: 1, 
        expireOn: 1
      }
    }
);
if (deleteProduct.modifiedCount > 0) {
  return res.status(200).json({ 
    success: true, 
    message: "Offer deleted from product successfully" 
  });
} else {
  return res.status(200).json({ 
    success: false, 
    message: "No changes made to product" 
  });
}
  
}
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



 const editProduct = async (req, res) => {
   try {
     const id = req.params.id;
     const product = await Product.findById(id);
 
     if (!product) {
       return res.status(404).json({ 
         success: false,
         error: "Product not found." 
       });
     }
 
     const data = req.body;
 
     // Validate product name uniqueness
     if (data.productName && data.productName !== product.productName) {
       const existingProduct = await Product.findOne({
         productName: data.productName,
         _id: { $ne: id }
       });
 
       if (existingProduct) {
         return res.status(409).json({
           success: false,
           error: "Product name already exists. Use a different name."
         });
       }
     }
 
     // Handle image updates
     const updateFields = {
       productName: data.productName || product.productName,
       description: data.description || product.description,
       brand: data.brand || product.brand,
       category: data.category || product.category,
       regularPrice: data.regularPrice || product.regularPrice,
       salePrice: data.salePrice || product.salePrice,
       quantity: data.quantity || product.quantity,
     };

     // Process new images
     if (req.files?.length > 0) {
       const currentImageCount = product.productImages ? product.productImages.length : 0;
       const totalImages = currentImageCount + req.files.length;

       if (totalImages > 4) {
         return res.status(400).json({
           success: false,
           error: "Maximum 4 images allowed. Please delete some existing images first."
         });
       }

       // Process and resize new images
       const newImages = [];
       for (const file of req.files) {
         const resizedImagePath = path.join("public", "uploads", "product-images", file.filename);
         await sharp(file.path)
           .resize({ width: 440, height: 440 })
           .toFile(resizedImagePath);
         newImages.push(file.filename);
       }

       // Add new images to existing ones
       updateFields.$push = { 
         productImages: { $each: newImages } 
       };
     }

     // Check final image count
     const finalImageCount = (product.productImages?.length || 0) + (req.files?.length || 0);
     if (finalImageCount < 3 || finalImageCount > 4) {
       return res.status(400).json({
         success: false,
         error: "Products must have between 3 and 4 images before saving."
       });
     }
 
     // Perform the update
     const updatedProduct = await Product.findByIdAndUpdate(
       id,
       updateFields,
       { new: true, runValidators: true }
     );
 
     res.status(200).json({
       success: true,
       message: "Product updated successfully",
       product: updatedProduct
     });
 
   } catch (error) {
     console.error("Update error:", error);
     res.status(500).json({
       success: false,
       error: process.env.NODE_ENV === 'development' 
         ? error.message 
         : "Internal server error"
     });
   }
 };

 const deleteSingleImage = async (req, res) => {
   try {
     const { imageNameToServer, productIdToServer } = req.body;

     // Get current product
     const product = await Product.findById(productIdToServer);
     if (!product) {
       return res.status(404).json({ error: "Product not found" });
     }
 
     // Delete physical file
     const imagePath = path.join("public", "uploads", 'product-images', imageNameToServer);
     if (fs.existsSync(imagePath)) {
       fs.unlinkSync(imagePath);
       console.log("Image deleted successfully");
     }
 
     // Update product document
     const updatedProduct = await Product.findByIdAndUpdate(
       productIdToServer,
       { $pull: { productImages: imageNameToServer } },
       { new: true }
     );
 
     res.json({ 
       success: true,
       message: "Image deleted successfully",
       remainingImages: updatedProduct.productImages
     });
 
   } catch (error) {
     console.error(error);
     res.status(500).json({ error: "Failed to delete image" });
   }
 };
 module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    toggleProductList,
    getEditProduct,
    editProduct,deleteSingleImage,addProductOffers,
    deleteOffers,
   
    
 }                                             