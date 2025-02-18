const Product = require("../../model/productShema");
const User = require("../../model/userSchema");
const Cart = require("../../model/cartSchema")
const Category = require("../../model/categorySchema");
const Wishlist = require("../../model/WishlistSchema");

const MAX_QUANTITY_PER_ITEM = 5;
const MIN_QUANTITY_PER_ITEM = 1;

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const isLoggedIn = req.session.isLoggedIn || false;
        
        let cart = await Cart.findOne({ userId }).populate("item.productId");
        if (!cart) {
            cart = { item: [] }; // Ensure cart is always an object
        }
        
        res.render("cart", { cart, isLoggedIn }); // Pass full cart object
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ message: "Server error" });
    }
};



const addcart = async (req, res) => {
    const productId = req.query.id; // Get the product ID from query params
    const userId = req.session.user; // Get the user ID from session
    const quantity = parseInt(req.query.quantity) || 1; // Default to 1 if not provided
    const fromWishlist = req.query.fromWishlist === 'true'; // Check if adding from wishlist

    try {
        // Fetch the product details from the database
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is available
        if (product.status !== "available" || product.quantity === 0) {
            return res.status(400).json({ success: false, message: 'Product is out of stock' });
        }

        let userCart = await Cart.findOne({ userId: userId });

        if (userCart) {
            // Check if the product already exists in the cart
            const existingProductIndex = userCart.item.findIndex(
                (item) => item.productId.toString() === productId
            );

            if (existingProductIndex !== -1) {
                // Calculate new quantity
                const newQuantity = userCart.item[existingProductIndex].quantity + quantity;
                
                // Check if new quantity exceeds maximum limit or available stock
                if (newQuantity > MAX_QUANTITY_PER_ITEM) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Maximum limit of ${MAX_QUANTITY_PER_ITEM} items per product reached` 
                    });
                }

                if (newQuantity > product.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Only ${product.quantity} items available in stock` 
                    });
                }

                // If the product exists, increase the quantity
                userCart.item[existingProductIndex].quantity = newQuantity;
                userCart.item[existingProductIndex].totalPrice =
                    userCart.item[existingProductIndex].quantity * userCart.item[existingProductIndex].price;

                await userCart.save();
                return res.status(200).json({ 
                    success: true, 
                    message: 'Product quantity updated in cart'
                });
            } else {
                // Check if quantity is within limits and available stock
                if (quantity > MAX_QUANTITY_PER_ITEM) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Maximum limit of ${MAX_QUANTITY_PER_ITEM} items per product reached` 
                    });
                }

                if (quantity > product.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Only ${product.quantity} items available in stock` 
                    });
                }

                // If the product doesn't exist, add it to the cart
                userCart.item.push({
                    productId: productId,
                    quantity: quantity,
                    price: product.salePrice,
                    totalPrice: quantity * product.salePrice,
                });

                await userCart.save();
                return res.status(200).json({
                    success: true,
                    message: 'Product added to cart successfully'
                });
            }
        } else {
            // Check if quantity is within limits and available stock
            if (quantity > MAX_QUANTITY_PER_ITEM) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Maximum limit of ${MAX_QUANTITY_PER_ITEM} items per product reached` 
                });
            }

            if (quantity > product.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Only ${product.quantity} items available in stock` 
                });
            }

            // If the cart doesn't exist, create a new cart with the product
            const newCart = new Cart({
                userId: userId,
                item: [{
                    productId: productId,
                    quantity: quantity,
                    price: product.salePrice,
                    totalPrice: quantity * product.salePrice, 
                }]
            });

            await newCart.save();
            return res.status(200).json({ 
                success: true, 
                message: 'Product added to cart successfully'
            });
        }

        // If the item was added from wishlist, remove it from wishlist
        if (fromWishlist) {
            await Wishlist.updateOne(
                { userId: userId },
                { 
                    $pull: { 
                        products: {
                            productId: productId
                        }
                    }
                }
            );
            return res.status(200).json({ 
                success: true, 
                message: 'Product added to cart and removed from wishlist'
            });
        }
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            message: 'An error occurred while adding product to the cart'
        });
    }
};
  
  const deleteitem = async (req, res) => {
    try {
        console.log('Delete item controller reached');
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        console.log('Request body:', req.body);
        console.log('Request query:', req.query);
        
        const userId = req.session.user;
        // Check both body and query for product ID
        const productId = req.body.id || req.query.id;

        console.log('userId:', userId);
        console.log('productId:', productId);

        if (!userId) {
            console.log('User not authenticated');
            return res.status(401).json({ 
                success: false,
                message: "User not authenticated" 
            });
        }

        if (!productId) {
            console.log('Product ID missing');
            return res.status(400).json({ 
                success: false,
                message: "Product ID is required" 
            });
        }

        let cart = await Cart.findOne({ userId });
        console.log('Found cart:', cart);

        if (!cart) {
            console.log('Cart not found');
            return res.status(404).json({ 
                success: false,
                message: "Cart not found" 
            });
        }

        // Filter out the item to be removed
        const originalLength = cart.item.length;
        cart.item = cart.item.filter(item => item.productId.toString() !== productId);
        
        if (cart.item.length === originalLength) {
            console.log('Product not found in cart');
            return res.status(404).json({ 
                success: false,
                message: "Product not found in cart" 
            });
        }

        // Save the updated cart
        await cart.save();
        console.log('Cart updated successfully');

        res.json({ 
            success: true,
            message: "Product removed from cart" 
        });
    } catch (error) {
        console.error("Error removing product from cart:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        const newQuantity = parseInt(req.body.quantity);

        // Get product details to check stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product is in stock
        if (product.status !== "available" || product.quantity === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product is out of stock' 
            });
        }

        // Check if requested quantity is available
        if (newQuantity > product.quantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Only ${product.quantity} items available in stock` 
            });
        }

        // Validate quantity limits
        if (newQuantity < MIN_QUANTITY_PER_ITEM) {
            return res.status(400).json({
                success: false,
                message: `Minimum quantity is ${MIN_QUANTITY_PER_ITEM} item`
            });
        }

        if (newQuantity > MAX_QUANTITY_PER_ITEM) {
            return res.status(400).json({
                success: false,
                message: `Maximum limit of ${MAX_QUANTITY_PER_ITEM} items per product reached`
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const itemIndex = cart.item.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        // Update quantity and total price
        cart.item[itemIndex].quantity = newQuantity;
        cart.item[itemIndex].totalPrice = newQuantity * cart.item[itemIndex].price;

        await cart.save();

        return res.status(200).json({
            success: true,
            message: 'Cart quantity updated successfully',
            newQuantity,
            newTotalPrice: cart.item[itemIndex].totalPrice
        });
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the cart'
        });
    }
};

////////////////////////////////////////////////////
// const{addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body;
// const userAddress = await Address.findOne({userId:req.session.user})
// if(!userAddress){
//     const newAddress = new Address({
//         userId:userid,
//         address:[{addressType,name,city,landMark,state,pincode,phone,altPhone}] 
        

//     })
//     await newAddress.save();
// }else{
//     userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
//     await userAddress.save();
// }
// res.redirect("/user-address");

// }catch(error){
// console.error("error adding Address",error);
// }}



// }
module.exports={
    getCart,
    addcart,
    deleteitem,
    updateCartQuantity
}