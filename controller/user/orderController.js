const User = require("../../model/userSchema")
const Product = require('../../model/productShema')
const Cart = require("../../model/cartSchema")
const Order = require("../../model/orderSchema")
const Address = require('../../model/addressSchema')
const Coupon = require("../../model/couponSchema")
const mongoose = require('mongoose')

const getcheckout = async (req, res) => {
   try {
      const userId = req.session.user;
      const addressDoc = await Address.findOne({userId:userId})
      const isLoggedIn = req.session.isLoggedIn || false;
      
      const user = await User.findById(userId);
      const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
      
      if (!cart || cart.item.length === 0) {
         return res.redirect('/cart');
      }

      res.render("checkout", {
         user,
         cart: cart.item,
         isLoggedIn,
         address: addressDoc ? addressDoc.address : []
      });
   } catch (error) {
      console.error("Error in checkout:", error);
      res.status(500).render('error', { message: 'Internal server error' });
   }
}

const placeOrder = async (req, res) => {
    try {
        const { productId } = req.query;
        const { quantity } = req.query;
        const { address, paymentMethod, appliedCoupon } = req.body;
        const userId = req.session.user;

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Calculate total price
        const total = product.salePrice * quantity;
        let discountAmount = 0;
        let couponApplied = false;
        let couponId = null;

        // Check and apply coupon if provided
        if (appliedCoupon) {
            const coupon = await Coupon.findOne({ 
                name: appliedCoupon,
                islist: true,
                expireOn: { $gt: new Date() },
                minimumPrice: { $lte: total },
                $or: [
                    { UserId: { $exists: false } },
                    { UserId: { $nin: [userId] } }
                ]
            });

            if (coupon) {
                // Calculate discount
                if (coupon.couponType === 'percentage') {
                    discountAmount = (total * coupon.offerPrice) / 100;
                    // Apply maximum discount cap for percentage coupons
                    if (discountAmount > coupon.maximumDiscountAmount) {
                        discountAmount = coupon.maximumDiscountAmount;
                    }
                } else {
                    discountAmount = coupon.offerPrice;
                }

                // Set coupon applied flag and ID
                couponApplied = true;
                couponId = coupon._id;
            }
        }

        // Calculate final price after discount
        const finalPrice = total - discountAmount;

        // Create order
        const newOrder = new Order({
            userId: userId,
            orderedItems: [{
                product: productId,
                quantity: quantity,
                price: product.salePrice
            }],
            totalPrice: total,
            discount: discountAmount,
            finalAmount: finalPrice,
            address: address,
            paymentMethod: paymentMethod,
            couponApplied: couponApplied,
            couponId: couponId
        });

        await newOrder.save();

        // Update product stock
        await Product.findByIdAndUpdate(productId, { 
            $inc: { stock: -quantity } 
        });

        // If a coupon was used, mark it as used by this user
        if (couponApplied && couponId) {
            await Coupon.findByIdAndUpdate(couponId, {
                $push: { UserId: userId }
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Order placed successfully',
            orderId: newOrder._id 
        });

    } catch (error) {
        console.error('Error in placeOrder:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to place order',
            error: error.message 
        });
    }
};

const addAddress = async (req, res) => {
   try {
      const userId = req.session.user;
      const { 
         addressType, 
         name, 
         city, 
         landMark, 
         state, 
         pincode, 
         phone, 
         altPhone 
      } = req.body;

      // Find or create address document for the user
      let addressDoc = await Address.findOne({ userId });
      
      if (!addressDoc) {
         addressDoc = new Address({ 
            userId, 
            address: [] 
         });
      }

      // Create new address object
      const newAddress = {
         _id: new mongoose.Types.ObjectId(),
         addressType,
         name,
         city,
         landMark,
         state,
         pincode,
         phone,
         altPhone
      };

      // Add new address to the array
      addressDoc.address.push(newAddress);

      // Save the document
      await addressDoc.save();

      res.status(201).json({ 
         message: 'Address added successfully', 
         address: newAddress 
      });
   } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({ error: 'Failed to add address' });
   }
}

const editAddress = async (req, res) => {
   try {
      const userId = req.session.user;
      const { 
         addressId,
         addressType, 
         name, 
         city, 
         landMark, 
         state, 
         pincode, 
         phone, 
         altPhone 
      } = req.body;

      // Find the address document for the user
      const addressDoc = await Address.findOne({ userId });
      
      if (!addressDoc) {
         return res.status(404).json({ error: 'Address document not found' });
      }

      // Find the specific address to update
      const addressToUpdate = addressDoc.address.find(addr => addr._id.toString() === addressId);
      
      if (!addressToUpdate) {
         return res.status(404).json({ error: 'Address not found' });
      }

      // Update address details
      addressToUpdate.addressType = addressType;
      addressToUpdate.name = name;
      addressToUpdate.city = city;
      addressToUpdate.landMark = landMark;
      addressToUpdate.state = state;
      addressToUpdate.pincode = pincode;
      addressToUpdate.phone = phone;
      addressToUpdate.altPhone = altPhone;

      // Save the updated document
      await addressDoc.save();

      res.status(200).json({ 
         message: 'Address updated successfully', 
         address: addressToUpdate 
      });
   } catch (error) {
      console.error("Error editing address:", error);
      res.status(500).json({ error: 'Failed to edit address' });
   }
}

const loadUserOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("Fetching orders for user ID:", userId);
          const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
            
            // If the cart exists, map cart items and include product details
            if (userCart) {
                cart = userCart.item.map(item => ({
                    productId: item.productId._id,  // Product ID
                    name: item.productId.productName,  // Product Name
                    price: item.price,  // Price of the item in the cart
                    quantity: item.quantity,  // Quantity of the item
                    totalPrice: item.totalPrice,  // Calculated total price of the item
                    image: item.productId.productImages[0]  // Image of the product
                }));
            }
        

        if (!userId) {
            console.error("No user ID in session");
            return res.status(401).render('error', { 
                message: 'User not authenticated',
                error: 'No user ID found in session' 
            });
        }
        
        // Validate user exists
        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found:", userId);
            return res.status(404).render('error', { 
                message: 'User not found',
                error: 'No user found with the given ID' 
            });
        }
        
        // Fetch orders with detailed population
        const orders = await Order.find({ userId: userId })
            .populate({
                path: 'orderedItems.product',
                model: 'Product', // Use the correct model name
                select: 'productName productImages' // Select only necessary fields
            })
            .sort({ invoiceDate: -1 }) // Sort by invoice date
            .lean(); // Convert to plain JavaScript object for easier manipulation
        
        console.log("Found orders:", orders.length);
        
        // Transform orders to ensure all required fields are present
        const processedOrders = orders.map(order => ({
            ...order,
            orderId: order.orderId || order._id.toString(), // Use orderId or fallback to _id
            orderedItems: order.orderedItems.map(item => ({
                ...item,
                productImage: item.product && item.product.productImages && item.product.productImages.length > 0
                    ? `/uploads/product-images/${item.product.productImages[0]}` 
                    : '/default-product-image.png',
                productName: item.productName || (item.product ? item.product.productName : 'Unknown Product')
            }))
        }));
        
        const isLoggedIn = req.session.isLoggedIn || false;
        
        res.render('orders', {
            orders: processedOrders,
            isLoggedIn,cart
        });
    } catch (error) {
        console.error("Critical error in loadUserOrders:", error);
        
        // Create a simple error view if the default error view is missing
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <h1>An Error Occurred</h1>
                <p>${process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'}</p>
            </body>
            </html>
        `;
        
        res.status(500).send(errorHtml);
    }
};
const loadOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId  = req.query.id;
        
        console.log('Debug: Fetching order details', { userId, orderId });

        if (!userId) {
            console.error('No user ID in session');
            return res.status(401).render('error', { 
                message: 'User not authenticated',
                error: 'No user ID found in session' 
            });
        }

        const order = await Order.findOne({ 
            orderId: orderId, 
            userId: userId 
        })
        .populate({
            path: 'orderedItems.product',
            model: 'Product',
            select: 'productName productImages regularPrice salePrice'
        })
        .lean();

       console.log(`this just my console${order}`)

        if (!order) {
            console.error('Order not found', { orderId, userId });
            return res.status(404).render('error', { 
                message: 'Order not found',
                error: 'The specified order could not be found' 
            });
        }

        const userAddresses = await Address.findOne({ userId: userId });
        let address = null;
        if (userAddresses && userAddresses.address) {
            address = userAddresses.address.find(addr => 
                addr._id.toString() === order.address.toString()
            );
        }

        // Prepare order items with single image
        const products = order.orderedItems.map(item => {
            // Get first available image or use default
            const firstImage = item.product?.productImages?.[0] || 'default-product-image.png';
            
            console.log('Product Image Selected:', {
                productName: item.productName || (item.product ? item.product.productName : 'Unknown Product'),
                selectedImage: firstImage
            });

            return {
                productName: item.productName || (item.product ? item.product.productName : 'Unknown Product'),
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
                productImage: firstImage // Now just a single image string instead of an array
            };
        });

        // Fetch user's cart with single image per item
        let cart = [];
        const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
        if (userCart) {
            cart = userCart.item.map(item => ({
                productId: item.productId._id,
                name: item.productId.productName,
                price: item.price,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                image: item.productId.productImages?.[0] || 'default-product-image.png'
            }));
        }

        const isLoggedIn = req.session.isLoggedIn || false;

        console.log('Debug: Rendering Order Details', {
            orderDetails: {
                orderId: order.orderId,
                productsCount: products.length,
                productImages: products.map(p => p.productImage)
            }
        });

        res.render('orderdetails', {
            order: {
                _id:order._id,
                orderId: order.orderId,
                status: order.status,
                totalPrice: order.totalPrice,
                discount: order.discount || 0,
                finalAmount: order.finalAmount,
                invoiceDate: order.invoiceDate,
                paymentMethod: order.paymentMethod,
                couponApplied: order.couponApplied || false
            },
            address: address || { 
                name: 'Address Not Found',
                city: 'N/A',
                state: 'N/A',
                pincode: 'N/A',
                landmark: 'N/A',
                country: 'N/A',
                phone: 'N/A'
            },
            products: products.map(product => ({
                ...product,
                productImage: `/uploads/product-images/${product.productImage}`
            })),
            isLoggedIn,
            cart
        });
    } catch (error) {
        console.error("Critical error in loadOrderDetails:", error);
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <h1>An Error Occurred</h1>
                <p>${process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'}</p>
                <pre>${error.stack}</pre>
            </body>
            </html>
        `;
        res.status(500).send(errorHtml);
    }
};
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const {_id}= req.query;
        console.log(`this is the object isd ${_id}`)
        const { reason } = req.body;

        // Validate input
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        if (!_id|| !reason) {
            return res.status(400).json({ 
                success: false, 
                message: 'Order ID and cancellation reason are required' 
            });
        }

        // Find the order and verify ownership
        const order = await Order.findOne({ 
            _id:_id, 
            userId: userId 
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Check if order can be cancelled
        const cancelableStatuses = ['Pending', 'Processing'];
        if (!cancelableStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'This order cannot be cancelled' 
            });
        }

        // Update order status and add cancellation details
        order.status = 'Cancelled';
        order.cancelReason = reason;
        order.cancelledAt = new Date();

        // Save the updated order
        await order.save();

        // Optionally, restore product quantities
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(
                item.product, 
                { $inc: { quantity: item.quantity } }
            );
        }

        // Log the cancellation
        console.log(`Order ${_id} cancelled by user ${userId}. Reason: ${reason}`);

        res.status(200).json({ 
            success: true, 
            message: 'Order cancelled successfully' 
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const returnOrder = async (req, res) => {
    try {
        console.log("kedhflikqehbflukjiqwahbfljhkeabfcvljkahb")
        const userId = req.session.user;
        const {_id}= req.query;
        const { reason } = req.body;

        // Validate input
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        if (!_id || !reason) {
            return res.status(400).json({ 
                success: false, 
                message: 'Order ID and return reason are required' 
            });
        }

        // Find the order and verify ownership
        const order = await Order.findOne({ 
            _id: _id, 
            userId: userId 
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Check if order can be returned
        const returnableStatuses = ['Delivered'];
        if (!returnableStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'This order is not eligible for return' 
            });
        }

        // Update order status and add return details
        order.status = 'Request Return';
        order.returnReason= reason;
        order.returnedAt = new Date();

        // Save the updated order
        await order.save();

        // Log the return request
        console.log(`Return requested for order ${_id} by user ${userId}. Reason: ${reason}`);

        res.status(200).json({ 
            success: true, 
            message: 'Return request submitted successfully' 
        });

    } catch (error) {
        console.error('Error processing return request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
const getdirectcheackout=async(req,res)=>{
    try {
        const userId = req.session.user;
        const addressDoc = await Address.findOne({userId:userId})
        const isLoggedIn = req.session.isLoggedIn || false;
        const user = await User.findById(userId);
        const productId = req.query.productId;
        const product = await Product.findOne({ _id:productId })
        const cart = await Cart.findOne({ userId: userId })
        const quantity = req.query.quantity;
        const total = product.salePrice * quantity;
        
        // Fetch available coupons
        const currentDate = new Date();
        const availableCoupons = await Coupon.find({
            islist: true,
            expireOn: { $gt: currentDate },
            minimumPrice: { $lte: total },
            $or: [
                { UserId: { $exists: false } },
                { UserId: { $nin: [userId] } }
            ]
        }).sort({ createdOn: -1 });

        res.render("directCheackout", {
            user,
            quantity,
            product,
            isLoggedIn,
            cart,
            coupons: availableCoupons,
            address: addressDoc ? addressDoc.address : []
        });
    } catch (error) {
        console.error("Error in checkout:", error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
}

const applyCoupon = async(req,res)=>{
    try {
        const { couponCode, total } = req.body;
        const userId = req.session.user;
        console.log("its inside the apply coupon")

        // Find the coupon
        const coupon = await Coupon.findOne({ 
            name: couponCode,
            islist: true,
            expireOn: { $gt: new Date() },
            minimumPrice: { $lte: total },
            $or: [
                { UserId: { $exists: false } },
                { UserId: { $nin: [userId] } }
            ]
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired coupon"
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.couponType === 'percentage') {
            discountAmount = (total * coupon.offerPrice) / 100;
            // Apply maximum discount cap for percentage coupons
            if (discountAmount > coupon.maximumDiscountAmount) {
                discountAmount = coupon.maximumDiscountAmount;
            }
        } else {
            discountAmount = coupon.offerPrice;
        }

        // Calculate final amount
        const finalAmount = total - discountAmount;

        res.status(200).json({
            success: true,
            message: "Coupon applied successfully",
            discount: discountAmount,
            finalAmount: finalAmount,
            couponDetails: {
                code: coupon.name,
                type: coupon.couponType,
                value: coupon.offerPrice
            }
        });

    } catch (error) {
        console.error("Error in applyCoupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to apply coupon"
        });
    }
}

module.exports = {
    getcheckout,
    placeOrder,
    addAddress,
    editAddress,
    loadUserOrders,
    loadOrderDetails,
    cancelOrder,
    returnOrder,
    getdirectcheackout,
    applyCoupon
};