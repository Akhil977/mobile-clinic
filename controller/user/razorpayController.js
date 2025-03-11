const env = require("dotenv").config();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../model/orderSchema');
const Product = require('../../model/productShema');
const Coupon = require('../../model/couponSchema');
const Cart = require("../../model/cartSchema")

// Initialize Razorpay with test mode credentials
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwoHfudUBOGaKY',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU'
});

// Create Razorpay order for Direct Checkout (Unchanged)
const createOrder = async (req, res) => {
    try {
        const { 
            amount,
            productId,
            quantity,
            addressId,
            appliedCouponId,
            totalPrice,
            discountAmount 
        } = req.body;
        
        console.log('Creating direct order with details:', req.body);
        
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        if (!productId || !quantity || !addressId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required order details'
            });
        }

        const amountInPaise = Math.round(amount * 100);
        console.log('Amount in paise:', amountInPaise);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'order_' + Date.now(),
            payment_capture: 1,
            notes: {
                productId,
                quantity,
                addressId,
                appliedCouponId: appliedCouponId || '',
                totalPrice: totalPrice || amount,
                discountAmount: discountAmount || 0
            }
        };

        console.log('Creating order with options:', options);
        
        const order = await razorpay.orders.create(options);
        console.log('Order created:', order);

        if (!order || !order.id) {
            throw new Error('Failed to create Razorpay order');
        }

        res.json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwoHfudUBOGaKY'
        });
    } catch (error) {
        console.error('Error creating direct order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            details: error.message
        });
    }
};

// Verify Razorpay payment for Direct Checkout (Unchanged)
const verifyPayment = async (req, res) => {
    try {
        console.log('Received direct payment verification request:', req.body);

        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            addressId,
            totalPrice,
            productId,
            quantity,
            appliedCouponId,
            discountAmount,
            finalAmount
        } = req.body;

        if (!razorpay_order_id || !productId || !quantity || !addressId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required order details'
            });
        }

        const userId = req.session.user;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        let paymentStatus = 'Pending';
        let couponApplied = false;
        let couponId = null;

        if (appliedCouponId) {
            const coupon = await Coupon.findOne({ name: appliedCouponId });
            if (coupon) {
                couponApplied = true;
                couponId = coupon._id;
                await Coupon.findByIdAndUpdate(couponId, {
                    $push: { UserId: userId }
                });
            }
        }

        if (razorpay_payment_id && razorpay_signature) {
            const text = `${razorpay_order_id}|${razorpay_payment_id}`;
            const generatedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU')
                .update(text)
                .digest('hex');

            console.log('Signature verification:', {
                received_signature: razorpay_signature,
                generated_signature: generatedSignature
            });

            if (generatedSignature === razorpay_signature) {
                paymentStatus = 'Paid';
            }
        }

        const order = new Order({
            userId,
            orderedItems: [{
                product: productId,
                quantity: parseInt(quantity),
                price: product.salePrice
            }],
            totalPrice: totalPrice,
            discount: discountAmount || 0,
            finalAmount: finalAmount || totalPrice,
            address: addressId,
            paymentMethod: 'UPI',
            paymentStatus,
            status: 'Placed',
            couponApplied,
            couponId,
            paymentDetails: razorpay_payment_id ? {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } : {}
        });

        await order.save();
        await Product.findByIdAndUpdate(productId, { $inc: { stock: -quantity } });

        console.log(`Direct order created with paymentStatus: ${paymentStatus}`);
        res.json({
            success: true,
            message: `Payment verification ${paymentStatus === 'Paid' ? 'successful' : 'failed, order placed with pending status'}`,
            orderId: order._id
        });
    } catch (error) {
        console.error('Error verifying direct payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            details: error.message
        });
    }
};

// Create Razorpay order for Cart Checkout
const createCartOrder = async (req, res) => {
    try {
        const { 
            amount,
            quantities,
            addressId,
            appliedCouponId,
            totalPrice,
            discountAmount 
        } = req.body;

        console.log('Creating cart order with details:', req.body);

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        if (!quantities || !addressId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required order details'
            });
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate('item.productId');
        if (!cart || !cart.item.length) {
            return res.status(400).json({
                success: false,
                error: 'Cart is empty'
            });
        }

        const amountInPaise = Math.round(amount * 100);
        console.log('Amount in paise:', amountInPaise);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'cart_order_' + Date.now(),
            payment_capture: 1,
            notes: {
                cartItems: cart.item.map((item, index) => ({
                    productId: item.productId._id,
                    quantity: parseInt(quantities[index] || item.quantity),
                    price: item.price
                })),
                addressId,
                appliedCouponId: appliedCouponId || '',
                totalPrice: totalPrice || amount,
                discountAmount: discountAmount || 0
            }
        };

        console.log('Creating cart order with options:', options);

        const order = await razorpay.orders.create(options);
        console.log('Cart order created:', order);

        if (!order || !order.id) {
            throw new Error('Failed to create Razorpay cart order');
        }

        res.json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwoHfudUBOGaKY'
        });
    } catch (error) {
        console.error('Error creating cart order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create cart order',
            details: error.message
        });
    }
};

// Verify Razorpay payment for Cart Checkout

const verifyCartPayment = async (req, res) => {
    try {
        console.log('Received cart payment verification request:', req.body);

        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            addressId,
            totalPrice,
            quantities,
            appliedCouponId,
            discountAmount,
            finalAmount
        } = req.body;

        if (!razorpay_order_id || !quantities || !addressId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required cart order details'
            });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        const cart = await Cart.findOne({ userId }).populate('item.productId');
        if (!cart || !cart.item.length) {
            return res.status(400).json({
                success: false,
                error: 'Cart is empty'
            });
        }

        if (quantities.length !== cart.item.length) {
            return res.status(400).json({
                success: false,
                error: 'Quantities array length does not match cart items'
            });
        }

        let paymentStatus = 'Pending'; // Default to Pending
        let couponApplied = false;
        let couponId = null;

        // Handle coupon if applied
        if (appliedCouponId) {
            const coupon = await Coupon.findOne({ name: appliedCouponId });
            if (coupon) {
                couponApplied = true;
                couponId = coupon._id;
                await Coupon.findByIdAndUpdate(couponId, {
                    $push: { UserId: userId }
                });
            }
        }

        // Verify payment signature if provided
        if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
            const text = `${razorpay_order_id}|${razorpay_payment_id}`;
            const generatedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU')
                .update(text)
                .digest('hex');

            console.log('Signature verification:', {
                received_signature: razorpay_signature,
                generated_signature: generatedSignature
            });

            if (generatedSignature === razorpay_signature) {
                paymentStatus = 'Paid'; // Only set to Paid if signature matches
            } else {
                console.log('Signature verification failed, keeping payment status as Pending');
            }
        } else {
            console.log('No payment details provided or payment failed, order will be placed as Pending');
        }

        // Create ordered items from cart
        const orderedItems = cart.item.map((item, index) => ({
            product: item.productId._id,
            quantity: parseInt(quantities[index] || item.quantity),
            price: item.price
        }));

        // Create the order regardless of payment status
        const order = new Order({
            userId,
            orderedItems,
            totalPrice: totalPrice || orderedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0),
            discount: discountAmount || 0,
            finalAmount: finalAmount || (totalPrice - (discountAmount || 0)),
            address: addressId,
            paymentMethod: 'UPI',
            paymentStatus, // Pending or Paid based on verification
            status: 'Placed',
            couponApplied,
            couponId,
            paymentDetails: razorpay_payment_id ? {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } : {}
        });

        await order.save();

        // Update stock and clear cart only if payment is successful
        if (paymentStatus === 'Paid') {
            for (const item of orderedItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { stock: -item.quantity }
                }).catch(err => console.error('Error updating stock:', err));
            }
            await Cart.findOneAndUpdate({ userId }, { $set: { item: [] } });
            console.log('Payment successful, stock updated and cart cleared');
        } else {
            console.log('Payment pending or failed, stock not updated, cart preserved');
        }

        console.log(`Cart order created with paymentStatus: ${paymentStatus}`);
        res.json({
            success: true,
            message: `Order placed successfully with payment status: ${paymentStatus}`,
            orderId: order._id
        });
    } catch (error) {
        console.error('Error verifying cart payment:', error);

        // Attempt to create order even if verification fails completely
        const userId = req.session.user;
        if (userId && req.body.addressId && req.body.quantities) {
            try {
                const cart = await Cart.findOne({ userId }).populate('item.productId');
                if (cart && cart.item.length) {
                    const orderedItems = cart.item.map((item, index) => ({
                        product: item.productId._id,
                        quantity: parseInt(req.body.quantities[index] || item.quantity),
                        price: item.price
                    }));
                    const fallbackOrder = new Order({
                        userId,
                        orderedItems,
                        totalPrice: req.body.totalPrice || orderedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0),
                        discount: req.body.discountAmount || 0,
                        finalAmount: req.body.finalAmount || (req.body.totalPrice - (req.body.discountAmount || 0)),
                        address: req.body.addressId,
                        paymentMethod: 'UPI',
                        paymentStatus: 'Pending',
                        status: 'Placed'
                    });
                    await fallbackOrder.save();
                    console.log('Fallback order created with Pending status due to error');
                    return res.status(500).json({
                        success: true,
                        message: 'Order placed with Pending status due to verification error',
                        orderId: fallbackOrder._id,
                        errorDetails: error.message
                    });
                }
            } catch (fallbackError) {
                console.error('Failed to create fallback order:', fallbackError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to verify cart payment',
            details: error.message
        });
    }
};
// Unchanged Pending Payment Functions
const initiatePendingPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        console.log('Received (in rupees):', { orderId, amount });
        
        if (!orderId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required details'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        if (order.userId.toString() !== req.session.user) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        if (order.paymentStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                error: 'Payment has already been processed'
            });
        }

        const amountInRupees = parseFloat(amount);
        if (isNaN(amountInRupees) || amountInRupees <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        const amountInPaise = Math.round(amountInRupees * 100);
        console.log('Converted to paise:', amountInPaise);

        if (amountInRupees < 1) {
            return res.status(400).json({
                success: false,
                error: 'Amount too low (minimum ₹1)'
            });
        }
        if (amountInRupees > 6500000) {
            return res.status(400).json({
                success: false,
                error: 'Amount exceeds maximum allowed (₹65,00,000)'
            });
        }

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'pending_payment_' + orderId,
            payment_capture: 1,
            notes: {
                orderId: orderId
            }
        };
        
        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay order created:', razorpayOrder);
        
        if (!razorpayOrder || !razorpayOrder.id) {
            throw new Error('Failed to create Razorpay order');
        }

        res.json({
            success: true,
            order: razorpayOrder,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwoHfudUBOGaKY'
        });
    } catch (error) {
        console.error('Error initiating pending payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate payment',
            details: error.message
        });
    }
};

const verifyPendingPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required verification details'
            });
        }

        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        if (order.userId.toString() !== req.session.user) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU')
            .update(text)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            order.paymentStatus = 'Paid';
            order.paymentDetails = {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            };
            
            await order.save();
            
            return res.json({
                success: true,
                message: 'Payment verification successful',
                orderId: order._id
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Error verifying pending payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            details: error.message
        });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    createCartOrder,
    verifyCartPayment,
    initiatePendingPayment,
    verifyPendingPayment
};