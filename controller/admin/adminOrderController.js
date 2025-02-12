const User = require("../../model/userSchema")
const Product = require('../../model/productShema')
const Cart = require("../../model/cartSchema")
const Order = require("../../model/orderSchema")
const Address = require('../../model/addressSchema')
const mongoose = require('mongoose')

const viewOrders = async (req, res) => {
    try {
        // Find all orders with optional user lookup
        const orders = await Order.aggregate([
            {
                $lookup: {
                    from: 'users', // Ensure this matches your users collection name
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: {
                    path: '$userDetails',
                    preserveNullAndEmptyArrays: true // This allows orders without users to be included
                }
            },
            {
                $project: {
                    orderId: 1,
                    date: 1,
                    finalAmount: 1,
                    status: 1,
                    returnStatus: 1,
                    userId: { $ifNull: ['$userDetails._id', null] },
                    userName: { $ifNull: ['$userDetails.name', 'Unknown User'] },
                    userEmail: { $ifNull: ['$userDetails.email', ''] }
                }
            }
        ]);

        // Log orders to see what's actually being retrieved
        console.log('Processed Orders:', JSON.stringify(orders, null, 2));

        // Render the view with processed orders
        res.render("orderlisting", { orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
}

// Mapping for return status to order status
const RETURN_STATUS_MAP = {
    'Request Return': 'Request Return',
    'Return Approved': 'Return Approved',
    'Return Rejected': 'Return Rejected',
    'Return Completed': 'Return Completed'
};

const updateStatus = async (req, res) => {
    try {
        console.log("Processing status update");
        const orderId = req.query.orderId;
        const statusType = req.query.statusType;
        const value = req.query.value;

        // Validate input
        if (!orderId || !statusType || !value) {
            return res.status(400).json({ 
                success: false, 
                message: "Order ID, status type, and value are required" 
            });
        }

        // Find the order
        const order = await Order.findById(orderId);

        // Check if order exists
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        // Update appropriate status based on statusType
        if (statusType === 'status') {
            order.status = value;
        } else if (statusType === 'returnStatus') {
            // Map return status to order status
            order.status = RETURN_STATUS_MAP[value] || value;
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid status type"
            });
        }

        await order.save();

        // Log the update
        console.log(`Order ${orderId} ${statusType} updated to ${value}`);

        // Send success response
        res.json({ 
            success: true, 
            message: `Order ${statusType} updated successfully`,
            updatedValue: value 
        });
    } catch (error) {
        // Log the error
        console.error('Error updating order status:', error);

        // Send error response
        res.status(500).json({ 
            success: false, 
            message: "Error updating order status",
            error: error.message 
        });
    }
}

const showOrderDetails = async (req, res) => {
    try {
        const orderId = req.query._id;
        const userId = req.query.user_id;
        
        console.log('Debug: Fetching admin order details', { orderId, userId });

        const order = await Order.findOne({ 
            _id: orderId, 
            userId: userId 
        })
        .populate({
            path: 'orderedItems.product',
            model: 'Product',
            select: 'productName productImages regularPrice salePrice'
        })
        .lean();

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
            const firstImage = item.product?.productImages?.[0] || 'default-product-image.png';
            
            return {
                productName: item.productName || (item.product ? item.product.productName : 'Unknown Product'),
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
                productImage: firstImage
            };
        });

        // Render the admin order details view
        res.render("adminOrderdetails", { 
            order, 
            products, 
            address, 
            isLoggedIn: req.session.isLoggedIn || false 
        });
    } catch (error) {
        console.error('Error fetching admin order details:', error);
        res.status(500).render('error', { 
            message: 'Internal Server Error',
            error: error.message 
        });
    }
}

module.exports = { viewOrders, updateStatus, showOrderDetails };