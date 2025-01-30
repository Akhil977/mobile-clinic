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

module.exports = {
    productDetails
};