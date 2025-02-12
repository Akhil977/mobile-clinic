const Product = require("../../model/productShema");
const User = require("../../model/userSchema");
const Cart = require("../../model/cartSchema")
const Category = require("../../model/categorySchema");

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
  
    try {
      // Fetch the product details from the database
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      // Check if the product is available
      if (product.status !== "available") {
        return res.status(400).json({ message: 'Product is not available' });
      }
  
      let userCart = await Cart.findOne({ userId: userId });
  
      if (userCart) {
        // Check if the product already exists in the cart
        const existingProductIndex = userCart.item.findIndex(
          (item) => item.productId.toString() === productId
        );
  
        if (existingProductIndex !== -1) {
          // If the product exists, increase the quantity
          userCart.item[existingProductIndex].quantity += 1;
          userCart.item[existingProductIndex].totalPrice =
            userCart.item[existingProductIndex].quantity * userCart.item[existingProductIndex].price;
  
          await userCart.save();
          return res.status(200).json({ message: 'Product quantity updated in the cart' });
        } else {
          // If the product doesn't exist, add it to the cart
          userCart.item.push({
            productId: productId,
            quantity: 1,
            price: product.salePrice, // Fetch price from product schema
            totalPrice: product.salePrice, // Quantity * Price (1 * salePrice)
          });
  
          await userCart.save();
          return res.status(200).json({ message: 'Product added to the cart' });
        }
      } else {
        // If the cart doesn't exist, create a new cart with the product
        const newCart = new Cart({
          userId: userId,
          item: [{
            productId: productId,
            quantity: 1,
            price: product.salePrice, // Fetch price from product schema
            totalPrice: product.salePrice, 
          }]
        });
  
        await newCart.save();
        return res.status(200).json({ message: 'Cart created and product added' });
      }
    } catch (err) {
      return res.status(500).json({ message: 'An error occurred while adding product to the cart', error: err.message });
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
        const { productId, quantity } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: "User not authenticated" 
            });
        }

        // Find the product to check its available quantity
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: "Product not found" 
            });
        }

        // Check if product is available
        if (product.status !== "available") {
            return res.status(400).json({ 
                success: false,
                message: "Product is out of stock" 
            });
        }

        // Check if requested quantity is valid
        if (quantity <= 0) {
            return res.status(400).json({ 
                success: false,
                message: "Quantity must be greater than 0" 
            });
        }

        // Check if requested quantity exceeds available stock
        if (quantity > product.quantity) {
            return res.status(400).json({ 
                success: false,
                message: "Requested quantity exceeds available stock",
                availableQuantity: product.quantity 
            });
        }

        // Find user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ 
                success: false,
                message: "Cart not found" 
            });
        }

        // Find the item in the cart
        const cartItem = cart.item.find(item => 
            item.productId.toString() === productId
        );

        if (!cartItem) {
            return res.status(404).json({ 
                success: false,
                message: "Product not found in cart" 
            });
        }

        // Update quantity and total price
        cartItem.quantity = quantity;
        cartItem.totalPrice = quantity * cartItem.price;

        // Save the updated cart
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            quantity: cartItem.quantity,
            totalPrice: cartItem.totalPrice,
            availableQuantity: product.quantity
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        return res.status(500).json({ 
            success: false,
            message: "Error updating cart quantity",
            error: error.message 
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