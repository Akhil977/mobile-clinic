const Product = require("../../model/productShema");
const User = require("../../model/userSchema");
const Category = require("../../model/categorySchema");
const Cart = require("../../model/cartSchema")

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        if (req.session.isLoggedIn) {
            const userId = req.session.user;
            const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
            
            if (userCart) {
                cart = userCart.item.map(item => ({
                    productId: item.productId._id,
                    name: item.productId.productName,
                    price: item.price,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    image: item.productId.productImages[0]
                }));
            }
        }else{
            cart=[];
        }

        // Get the user details from session
      
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



const getProduct = async (req, res) => {
    try {
        let cart = [];
        if (req.session.isLoggedIn) {
            const userId = req.session.user;
            const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
            
            if (userCart) {
                cart = userCart.item.map(item => ({
                    productId: item.productId._id,
                    name: item.productId.productName,
                    price: item.price,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    image: item.productId.productImages[0]
                }));
            }
        }
        const currentcat = req.query.category;
        const isLoggedIn = req.session.isLoggedIn || false;
        const searchQuery = req.query.search || "";
        const sort = req.query.sort || "all";
        const page = parseInt(req.query.page) || 1;
        const ITEMS_PER_PAGE = 12;

        // Find the category
        const category = await Category.findOne({ name: currentcat });
        if (!category) {
            return res.redirect("/pageNotFound");
        }

        // Build the query
        let query = {
            isListed: true,
            category: category._id
        };

        // Add search condition if search query exists
        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        // Get total count for pagination
        const totalItems = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        // Calculate pagination values
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const hasNextPage = ITEMS_PER_PAGE * page < totalItems;
        const hasPreviousPage = page > 1;
        const nextPage = page + 1;
        const previousPage = page - 1;
        const currentPage = page;

        // Determine sort order
        let sortOrder = {};
        switch (sort) {
            case "newest":
                sortOrder = { createdAt: -1 };
                break;
            case "price-low":
                sortOrder = { regularPrice: 1 };
                break;
            case "price-high":
                sortOrder = { regularPrice: -1 };
                break;
            case "a-z":
                sortOrder = { productName: 1 };
                break;
            case "z-a":
                sortOrder = { productName: -1 };
                break;
            default:
                sortOrder = { createdAt: -1 }; // Default to newest first
        }

        // Fetch products with pagination and sorting
        const products = await Product.find(query)
            .sort(sortOrder)
            .skip(skip)
            .limit(ITEMS_PER_PAGE);

        res.render("product", {cart,
            products,
            currentcat,
            isLoggedIn,
            searchQuery,
            currentSort: sort,
            totalPages,
            currentPage,
            hasNextPage,
            hasPreviousPage,
            nextPage,
            previousPage,
            category
        });

    } catch (error) {
        console.error("Error in getProduct controller:", error);
        res.redirect("/pageNotFound");
    }
}; 


module.exports = {
    productDetails,
    getProduct
};