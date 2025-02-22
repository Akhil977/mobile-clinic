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

        // Validate required fields
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            console.error('Missing payment parameters:', {
                payment_id: !!razorpay_payment_id,
                order_id: !!razorpay_order_id,
                signature: !!razorpay_signature
            });
            return res.status(400).json({
                success: false,
                error: 'Missing payment verification parameters'
            });
        }

        // Generate and verify signature
        console.log('Generating signature with:', {
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU'
        });
        
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'WV5tgwrpzKVky9VSUsiDOKdU')
            .update(text)
            .digest('hex');

        console.log('Signature verification details:', {
            text: text,
            received_signature: razorpay_signature,
            generated_signature: generatedSignature,
            match: generatedSignature === razorpay_signature
        });

        if (generatedSignature !== razorpay_signature) {
            console.error('Signature verification failed');
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Create the order in database
        const userId = req.session.user;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Handle coupon if applied
        let couponApplied = false;
        let couponId = null;
        if (appliedCouponId) {
            const coupon = await Coupon.findOne({ name: appliedCouponId });
            if (coupon) {
                couponApplied = true;
                couponId = coupon._id;
                // Mark coupon as used for this user
                await Coupon.findByIdAndUpdate(couponId, {
                    $push: { UserId: userId }
                });
            }
        }

        // Create the order with verified payment details
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
            paymentStatus: 'Paid',
            status: 'Placed',
            couponApplied,
            couponId,
            paymentDetails: {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            }
        });

        await order.save();

        // Update product stock
        await Product.findByIdAndUpdate(productId, { 
            $inc: { stock: -quantity } 
        });

        console.log('Payment verified and order created successfully');
        res.json({
            success: true,
            message: 'Payment verified successfully',
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

module.exports = {
    createOrder,
    verifyPayment
};
