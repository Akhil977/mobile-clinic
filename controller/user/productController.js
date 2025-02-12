const Product = require("../../model/productShema");
const User = require("../../model/userSchema");
const Category = require("../../model/categorySchema");

const productDetails = async (req, res) => {
    try {
        console.log("Fetching product details...");

        // Dummy cart data for testing
        const cart = [
            { name: "Product 1", price: 100, quantity: 2 },
            { name: "Product 2", price: 150, quantity: 1 },
        ];

        // Get the user details from session
        const userId = req.session.user;
        const userData = await User.findById(userId);

        // Get the product details using the ID from query parameters
        const productId = req.query.id;
        const product = await Product.findById(productId).populate("category");

        // Get the category and brand of the product
        const findCategory = product.category;
        const findBrand = product.brand;

        // Check if the user is logged in
        const isLoggedIn = req.session.isLoggedIn;

        // Find related products from the same brand, excluding the current product
        const relatedProducts = await Product.find({
            brand: findBrand,
            _id: { $ne: productId },
            isListed: true // Only fetch products that are listed
        });
        // Render the product details page and pass the necessary data
        res.render("product-details", {
            product: product,
            user: userData,
            quantity: product.quantity,
            category: findCategory,
            relatedProducts: relatedProducts,
            cart: cart,
            isLoggedIn: isLoggedIn,
            page: 'product-details'  // Pass 'product-details' for the active navbar link
        });

    } catch (error) {
        console.log("Error in product details controller:", error);
        res.redirect("/pageNotFound");
    }
};



const getProduct= async(req,res)=>{
    
    let currentcat=req.query.category
    const cart = [
        { name: "Product 1", price: 100, quantity: 2 },
        { name: "Product 2", price: 150, quantity: 1 },
    ];
   try {
    const isLoggedIn = req.session.isLoggedIn || false; 
    const val = req.query.search || ""; 
    const sortby = req.query.sortby || "default";
    const price = req.query.price || "all";
    const color = req.query.color || "all";
    const tags = req.query.tags || []; // Default empty tags array
    const category = await Category.findOne({ name:currentcat})
    category_id= category._id
    const product = await Product.find({ isListed: true,category:category_id})
    res.render("product",{cart,isLoggedIn,val,sortby,price,color,tags,product})
   } catch (error) {
    
   }
}

module.exports = {
    productDetails,
    getProduct
};