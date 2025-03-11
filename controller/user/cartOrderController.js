const User = require("../../model/userSchema");
const Product = require('../../model/productShema');
const Cart = require("../../model/cartSchema");
const Order = require("../../model/orderSchema");
const Address = require('../../model/addressSchema');
const Coupon = require('../../model/couponSchema');
const Wallet = require('../../model/walletSchema');
const mongoose = require('mongoose');

// Load Checkout Page from Cart
const getCartCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const isLoggedIn = req.session.isLoggedIn || false;

        // Fetch required data
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate('item.productId');
        const addressDoc = await Address.findOne({ userId });
        const wallet = await Wallet.findOne({ userId });

        if (!cart || !cart.item.length) {
            return res.redirect('/cart');
        }

        // Calculate total
        const total = cart.item.reduce((acc, item) => {
            return acc + (item.price * item.quantity);
        }, 0);

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

        res.render("checkout", {
            user,
            wallet: wallet || [],
            cart: cart.item,
            isLoggedIn,
            address: addressDoc ? addressDoc.address : [],
            total,
            coupons: availableCoupons
        });

    } catch (error) {
        console.error("Error in getCartCheckout:", error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
};

// Place Order from Cart
const placeCartOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { 
            address, 
            paymentMethod, 
            appliedCouponId,
            totalPrice,
            discountAmount,
            finalAmount 
        } = req.body;

        // Fetch cart
        const cart = await Cart.findOne({ userId }).populate('item.productId');
        if (!cart || !cart.item.length) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cart is empty' 
            });
        }

        // Log incoming data
        console.log({
            paymentMethod,
            appliedCouponId,
            totalPrice,
            discountAmount,
            finalAmount,
            address
        });

        // Calculate base price from cart items
        const basePrice = cart.item.reduce((acc, item) => {
            return acc + (item.price * item.quantity);
        }, 0);

        // Handle coupon
        let couponApplied = false;
        let couponId = null;
        let finalDiscountAmount = discountAmount || 0;
        let finalTotalPrice = totalPrice || basePrice;
        let finalFinalAmount = finalAmount || basePrice;

        if (appliedCouponId) {
            const coupon = await Coupon.findOne({ name: appliedCouponId });
            if (coupon) {
                couponApplied = true;
                couponId = coupon._id;
                finalDiscountAmount = discountAmount || 0;
                finalFinalAmount = finalAmount || (basePrice - finalDiscountAmount);
                
                // Mark coupon as used
                await Coupon.findByIdAndUpdate(couponId, {
                    $push: { UserId: userId }
                });
            }
        }

        // Handle wallet payment
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Wallet not found' 
                });
            }
            if (wallet.balance < finalFinalAmount) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Insufficient wallet balance',
                    walletBalance: wallet.balance,
                    requiredAmount: finalFinalAmount
                });
            }
            wallet.balance -= finalFinalAmount;
            await wallet.save();
        }

        // Create order items from cart
        const orderItems = cart.item.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price
        }));

        // Create new order
        const order = new Order({
            userId,
            orderedItems: orderItems,
            totalPrice: finalTotalPrice,
            discount: finalDiscountAmount,
            finalAmount: finalFinalAmount,
            address,
            paymentMethod: paymentMethod === 'COD' ? 'Cash on Delivery' : paymentMethod,
            paymentStatus: paymentMethod === 'UPI' ? 'Pending' : 'Completed',
            status: 'Placed',
            couponApplied,
            couponId
        });

        await order.save();

        // Update product stocks
        for (const item of cart.item) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { stock: -item.quantity }
            });
        }

        // Clear the cart
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { item: [] } }
        );

        res.status(200).json({ 
            success: true, 
            message: 'Order placed successfully',
            orderId: order._id 
        });

    } catch (error) {
        console.error("Error in placeCartOrder:", error);
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

// Note: The following functions (addAddress, editAddress, applyCoupon) 
// can be reused from your existing controller as they work the same way

module.exports = {
    getCartCheckout,
    placeCartOrder,
    addAddress,    // From your existing controller
    editAddress,   // From your existing controller
    applyCoupon    // From your existing controller
};