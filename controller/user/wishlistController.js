const Product = require("../../model/productShema");
const User = require("../../model/userSchema");
const Cart = require("../../model/cartSchema")
const Category = require("../../model/categorySchema");
const Wishlist = require("../../model/WishlistSchema")
const mongoose = require("mongoose");

const checkWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, message: "User not logged in" });
        }

        const wishlist = await Wishlist.findOne({ userId })
            .populate('products.productId');

        if (!wishlist || !wishlist.products) {
            return res.json({ success: true, wishlistProducts: [] });
        }

        // Filter out any null/undefined products and map to IDs
        const productIds = wishlist.products
            .filter(item => item && item.productId)
            .map(item => item.productId._id.toString());

        return res.json({ success: true, wishlistProducts: productIds });
    } catch (error) {
        console.error("Error checking wishlist:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const addwishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        // Check if product already exists in wishlist
        const existingWishlist = await Wishlist.findOne({
            userId: userObjectId,
            'products.productId': productObjectId
        });

        if (existingWishlist) {
            return res.status(400).json({ success: false, message: "Product already in wishlist" });
        }

        // Add product to wishlist
        await Wishlist.updateOne(
            { userId: userObjectId },
            { 
                $push: { 
                    products: {
                        productId: productObjectId,
                        addedOn: new Date()
                    }
                }
            },
            { upsert: true }
        );

        return res.json({ success: true, message: "Product added to wishlist" });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const productObjectId = new mongoose.Types.ObjectId(productId);

        // Remove product from wishlist
        const result = await Wishlist.updateOne(
            { userId: userObjectId },
            { 
                $pull: { 
                    products: {
                        productId: productObjectId
                    }
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "Product not found in wishlist" });
        }

        return res.json({ success: true, message: "Product removed from wishlist" });

    } catch (error) {
        console.error("Error removing from wishlist:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const getWishlist = async (req, res) => {
    try {
        const isLoggedIn = req.session.isLoggedIn || false;
        const userId = req.session.user;
        let cart = [];
        let wishlistProducts = [];

        if (!isLoggedIn) {
            return res.render("Wishlist", { cart, isLoggedIn, wishlistProducts });
        }

        // Get wishlist items for the specific user and populate product details
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: '_id productName regularPrice productImages'
            });

        // Transform the data structure to match the template expectations
        if (wishlist && wishlist.products) {
            wishlistProducts = wishlist.products
                .filter(item => item.productId) // Filter out any null or undefined products
                .map(item => ({
                    _id: item.productId._id,
                    productName: item.productId.productName,
                    regularPrice: item.productId.regularPrice,
                    productImages: item.productId.productImages || []
                }));
        }

        // Get cart items
        if (isLoggedIn) {
            const userCart = await Cart.findOne({ userId }).populate('item.productId');
            if (userCart && userCart.item) {
                cart = userCart.item
                    .filter(item => item.productId) // Filter out any null products
                    .map(item => ({
                        productId: item.productId._id,
                        name: item.productId.productName,
                        price: item.price,
                        quantity: item.quantity,
                        totalPrice: item.totalPrice,
                        image: item.productId.productImages ? item.productId.productImages[0] : ''
                    }));
            }
        }

        res.render("Wishlist", { cart, isLoggedIn, wishlistProducts });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        // Render the wishlist page with an error message instead of a separate error page
        res.render("Wishlist", { 
            cart: [], 
            isLoggedIn: req.session.isLoggedIn || false,
            wishlistProducts: [],
            error: "Unable to fetch wishlist items. Please try again later."
        });
    }
};

module.exports = {
    getWishlist,
    addwishlist,
    removeFromWishlist,
    checkWishlist
};