const env = require("dotenv").config();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../model/orderSchema');
const Product = require('../../model/productShema');
const Coupon = require('../../model/couponSchema');

// Initialize Razorpay with test mode credentials
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_kwoHfudUBOGaKY',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU'
});

// Create Razorpay order
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
        
        console.log('Creating order with details:', req.body);
        
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

        // Convert amount to paise (Razorpay expects amount in paise)
        const amountInPaise = Math.round(amount * 100);
        console.log('Amount in paise:', amountInPaise);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'order_' + Date.now(),
            payment_capture: 1, // Auto capture payment
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
        
        try {
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
        } catch (razorpayError) {
            console.error('Razorpay API Error:', razorpayError);
            res.status(500).json({
                success: false,
                error: 'Failed to create Razorpay order',
                details: razorpayError.message
            });
        }
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            details: error.message
        });
    }
};

// Verify Razorpay payment
const verifyPayment = async (req, res) => {
    try {
        console.log('Received payment verification request:', req.body);

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

        let paymentStatus = 'Pending'; // Default to pending
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
            // Generate and verify signature
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
                paymentStatus = 'Paid'; // Only mark as paid if signature matches
            }
        }

        // Create order even if payment is failed/pending
        const order = new Order({
            userId,
            orderedItems: [{
                product: productId,
                quantity: quantity,
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

        // Update product stock
        await Product.findByIdAndUpdate(productId, { 
            $inc: { stock: -quantity } 
        });

        console.log(`Order created with paymentStatus: ${paymentStatus}`);
        res.json({
            success: true,
            message: `Payment verification ${paymentStatus === 'Paid' ? 'successful' : 'failed, order placed with pending status'}`,
            orderId: order._id
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            details: error.message
        });
    }
};



const initiatePendingPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        console.log('Received (in rupees):', { orderId, amount }); // Debug log
        
        if (!orderId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required details'
            });
        }

        // Find the order
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Verify this order belongs to the current user
        if (order.userId.toString() !== req.session.user) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        // Verify payment is pending
        if (order.paymentStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                error: 'Payment has already been processed'
            });
        }

        // Validate amount in rupees
        const amountInRupees = parseFloat(amount);
        if (isNaN(amountInRupees) || amountInRupees <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        // Convert to paise for Razorpay (multiply by 100)
        const amountInPaise = Math.round(amountInRupees * 100);
        console.log('Converted to paise:', amountInPaise); // Debug log

        // Validate against Razorpay limits (in rupees)
        if (amountInRupees < 1) { // Minimum ₹1
            return res.status(400).json({
                success: false,
                error: 'Amount too low (minimum ₹1)'
            });
        }
        if (amountInRupees > 6500000) { // Maximum ₹65,00,000 in test mode
            return res.status(400).json({
                success: false,
                error: 'Amount exceeds maximum allowed (₹65,00,000)'
            });
        }

        const options = {
            amount: amountInPaise, // Razorpay expects paise
            currency: 'INR',
            receipt: 'pending_payment_' + orderId,
            payment_capture: 1,
            notes: {
                orderId: orderId
            }
        };
        
        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay order created:', razorpayOrder); // Debug log
        
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

// Verify payment for pending orders (unchanged)
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

        // Find the order
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Verify this order belongs to the current user
        if (order.userId.toString() !== req.session.user) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Generate and verify signature
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU')
            .update(text)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            // Update order payment status
            order.paymentStatus = 'Paid';
            
            // Store payment details
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
    verifyPendingPayment,
    initiatePendingPayment

};
