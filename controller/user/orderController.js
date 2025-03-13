const User = require("../../model/userSchema")
const Product = require('../../model/productShema')
const Cart = require("../../model/cartSchema")
const Order = require("../../model/orderSchema")
const Address = require('../../model/addressSchema')
const Coupon = require('../../model/couponSchema')
const Wallet = require('../../model/walletSchema')
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose')

const getcheckout = async (req, res) => {
   try {
      const userId = req.session.user;
      const addressDoc = await Address.findOne({userId:userId})
      const isLoggedIn = req.session.isLoggedIn || false;
      let wallet = await Wallet.findOne({userId:userId})
      
      const user = await User.findById(userId);
      const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
      
      if (!cart || cart.item.length === 0) {
         return res.redirect('/cart');
      }

      const total = cart.item.reduce((acc, curr) => {
        return acc + (curr.productId.salePrice * curr.quantity);
    }, 0)
      console.log(total)


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
         user,wallet,coupon:availableCoupons,
         cart: cart.item,
         isLoggedIn,
         address: addressDoc ? addressDoc.address : [],
         total
      });
   } catch (error) {
      console.error("Error in checkout:", error);
      res.status(500).render('error', { message: 'Internal server error' });
   }
}

const placeOrder = async (req, res) => {
    try {
        console.log("just cheaking wheather its working or not")
        // Get productId and quantity from either query params or body
        const productId = req.query.productId || req.body.productId;
        const quantity = req.query.quantity || req.body.quantity;
        const { 
            address, 
            paymentMethod, 
            appliedCouponId,
            totalPrice,
            discountAmount,
            finalAmount 
        } = req.body;

        const userId = req.session.user;
        
        // Log all incoming data
        console.log({
            paymentMethod,
            productId,
            quantity,
            appliedCouponId,
            totalPrice,
            discountAmount,
            finalAmount,
            address
        });

        if (paymentMethod != 'UPI') {
            // Find the product
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            // Calculate base price
            const basePrice = product.salePrice * quantity;

            // Handle coupon if applied
            let couponApplied = false;
            let couponId = null;
            let finalDiscountAmount = 0;
            let finalTotalPrice = basePrice;
            let finalFinalAmount = basePrice;

            if (appliedCouponId) {
                const coupon = await Coupon.findOne({ name: appliedCouponId });
                if (coupon) {
                    couponApplied = true;
                    couponId = coupon._id;
                    
                    // Use the passed discount amounts if available, otherwise use base price
                    finalDiscountAmount = discountAmount || 0;
                    finalTotalPrice = totalPrice || basePrice;
                    finalFinalAmount = finalAmount || (basePrice - finalDiscountAmount);

                    // Mark coupon as used for this user
                    await Coupon.findByIdAndUpdate(couponId, {
                        $push: { UserId: userId }
                    });
                }
            }

            // Validate wallet if selected
            if(paymentMethod === 'wallet'){
                let wallet = await Wallet.findOne({userId:userId});
                if(!wallet){
                    return res.status(404).json({ success: false, message: 'Wallet not found' });
                }
                // Check if wallet has sufficient balance
                if(wallet.balance < finalFinalAmount) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Insufficient wallet balance',
                        walletBalance: wallet.balance,
                        requiredAmount: finalFinalAmount
                    });
                }
                
                // Deduct amount from wallet
                wallet.balance -= finalFinalAmount;
                await wallet.save();
            }

            // Create the order
            const order = new Order({
                userId,
                orderedItems: [{
                    product: productId,
                    quantity: quantity,
                    price: product.salePrice
                }],
                totalPrice: finalTotalPrice,
                discount: finalDiscountAmount,
                finalAmount: finalFinalAmount,
                address: address,
                paymentMethod: paymentMethod === 'COD' ? 'Cash on Delivery' : paymentMethod,
                paymentStatus: 'Pending',
                status: 'Placed',
                couponApplied,
                couponId
            });

            await order.save();

            // Update product stock
            await Product.findByIdAndUpdate(productId, { 
                $inc: { stock: -quantity } 
            });

            res.status(200).json({ 
                success: true, 
                message: 'Order placed successfully',
                orderId: order._id 
            });
        }
    } catch (error) {
        console.error("Error in placeOrder:", error);
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

        // Pagination parameters
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 10; // Limit to 10 orders per page
        const skip = (page - 1) * limit;

        // Fetch cart
        const userCart = await Cart.findOne({ userId }).populate('item.productId');
        let cart = [];
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

        // Fetch total number of orders for pagination
        const totalOrders = await Order.countDocuments({ userId });

        // Fetch orders with pagination, sorted by date descending (newest first)
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'productName productImages'
            })
            .sort({ date: -1 }) // Sort by date field, newest first
            .skip(skip)
            .limit(limit)
            .lean();

        console.log("Found orders:", orders.length, "Page:", page);

        // Transform orders
        const processedOrders = orders.map(order => ({
            ...order,
            orderId: order.orderId || order._id.toString(),
            orderDate: new Date(order.date).toLocaleString(), // Use date field for display
            orderedItems: order.orderedItems.map(item => ({
                ...item,
                productImage: item.product && item.product.productImages && item.product.productImages.length > 0
                    ? `/uploads/product-images/${item.product.productImages[0]}`
                    : '/default-product-image.png',
                productName: item.productName || (item.product ? item.product.productName : 'Unknown Product')
            }))
        }));

        const isLoggedIn = req.session.isLoggedIn || false;
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('orders', {
            orders: processedOrders,
            isLoggedIn,
            cart,
            currentPage: page,
            totalPages,
            totalOrders
        });
    } catch (error) {
        console.error("Critical error in loadUserOrders:", error);
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
        const orderId = req.query.orderId || req.query.id;  
        console.log('Debug: Fetching order details', { userId, orderId });

        if (!userId) {
            console.error('No user ID in session');
            return res.redirect('/');  
        }

        if (!orderId) {
            console.error('No order ID provided');
            return res.redirect('/');  
        }

        const order = await Order.findById(orderId)  
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'productName productImages regularPrice salePrice'
            })
            .lean();

        if (!order) {
            console.error('Order not found', { orderId, userId });
            return res.redirect('/');  
        }

        // Verify the order belongs to the current user
        if (order.userId.toString() !== userId.toString()) {
            console.error('Order does not belong to user');
            return res.redirect('/');  
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
                productName: item.product ? item.product.productName : 'Unknown Product',
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
                productImage: firstImage
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

        res.render('orderdetails', {
            order: {
                _id: order._id,
                orderId: order.orderId,
                paymentStatus: order.paymentStatus,
                status: order.status,
                totalPrice: order.totalPrice,
                discount: order.discount || 0,
                finalAmount: order.finalAmount,
                invoiceDate: order.createdAt,
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
        console.error("Error in loadOrderDetails:", error);
        return res.redirect('/');  
    }
};

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.query._id;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).send('Unauthorized');
        }

        const order = await Order.findById(orderId)
            .populate('orderedItems.product');

        if (!order || order.status !== 'Delivered') {
            return res.status(404).send('Order not found or not delivered');
        }

        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).send('Forbidden: Order does not belong to user');
        }

        const userAddresses = await Address.findOne({ userId: userId });
        let address = null;
        if (userAddresses && userAddresses.address) {
            address = userAddresses.address.find(addr => 
                addr._id.toString() === order.address.toString()
            );
        }

        if (!address) {
            address = {
                name: 'Address Not Found',
                landmark: 'N/A',
                city: 'N/A',
                state: 'N/A',
                country: 'N/A',
                pincode: 'N/A',
                phone: 'N/A'
            };
        }

        const products = order.orderedItems.map(item => ({
            productName: item.product.productName,
            productImage: item.product.productImages?.[0] || 'default-product-image.png',
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
        }));

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order.orderId}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Invoice', { align: 'center' });
        doc.moveDown();

        // Order Details
        doc.fontSize(12).text(`Order #${order.orderId}`, { align: 'left' });
        // Assuming invoiceDate is a timestamp in the schema
        const invoiceDate = order.invoiceDate ? new Date(order.invoiceDate) : new Date();
        doc.text(`Invoice Date: ${invoiceDate.toLocaleString('en-IN', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`);
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);
        doc.moveDown();

        // Delivery Address
        doc.fontSize(14).text('Delivery Address:', { underline: true });
        doc.fontSize(12).text(`${address.name}`);
        doc.text(`${address.landmark}, ${address.city}, ${address.state}`);
        doc.text(`${address.country} ${address.pincode}`);
        doc.text(`Phone: ${address.phone}`);
        doc.moveDown();

        // Table for Ordered Items
        doc.fontSize(14).text('Ordered Items:', { underline: true });
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        const itemWidth = 200;
        const qtyWidth = 60;
        const priceWidth = 80;
        const totalWidth = 80;
        const tableLeft = 50;

        doc.fontSize(12).font('Helvetica-Bold')
            .text('Item', tableLeft, tableTop, { width: itemWidth })
            .text('Qty', tableLeft + itemWidth, tableTop, { width: qtyWidth, align: 'right' })
            .text('Price', tableLeft + itemWidth + qtyWidth, tableTop, { width: priceWidth, align: 'right' })
            .text('Total', tableLeft + itemWidth + qtyWidth + priceWidth, tableTop, { width: totalWidth, align: 'right' });

        // Draw table header line
        doc.moveTo(tableLeft, tableTop + 15)
           .lineTo(tableLeft + itemWidth + qtyWidth + priceWidth + totalWidth, tableTop + 15)
           .stroke();

        // Table Rows
        let currentY = tableTop + 20;
        doc.font('Helvetica');
        products.forEach((item, index) => {
            doc.fontSize(12)
                .text(item.productName.substring(0, 25), tableLeft, currentY, { width: itemWidth }) // Truncate long names
                .text(item.quantity, tableLeft + itemWidth, currentY, { width: qtyWidth, align: 'right' })
                .text(`₹${item.price}`, tableLeft + itemWidth + qtyWidth, currentY, { width: priceWidth, align: 'right' })
                .text(`₹${item.total}`, tableLeft + itemWidth + qtyWidth + priceWidth, currentY, { width: totalWidth, align: 'right' });
            currentY += 20;
        });

        // Draw table bottom line
        doc.moveTo(tableLeft, currentY)
           .lineTo(tableLeft + itemWidth + qtyWidth + priceWidth + totalWidth, currentY)
           .stroke();

        // Order Summary
        doc.moveDown(2);
        doc.fontSize(14).text('Order Summary:', { underline: true });
        const summaryLeft = 350;
        doc.fontSize(12)
            .text('Total Price:', summaryLeft, doc.y + 10)
            .text(`₹${order.totalPrice}`, summaryLeft + 100, doc.y - 12, { align: 'right' })
            .text('Discount:', summaryLeft, doc.y + 5)
            .text(`₹${order.discount}`, summaryLeft + 100, doc.y - 12, { align: 'right' });
        doc.fontSize(14).font('Helvetica-Bold')
            .text('Final Amount:', summaryLeft, doc.y + 10)
            .text(`₹${order.finalAmount}`, summaryLeft + 100, doc.y - 14, { align: 'right' });

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica')
            .text('Thank you for your purchase!', { align: 'center' })
            .moveDown(0.5)
            .text('Mobile Clinic', { align: 'center' })
            .text('Email: support@mobileclinic.com', { align: 'center' })
            .text('Phone: +91 12345 67890', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
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
        const cancelableStatuses = ['Pending', 'Processing',`Placed`];
        if (!cancelableStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'This order cannot be cancelled',
                
            });
        }

        // Update order status and add cancellation details
        order.status = 'Cancelled';
        order.cancelReason = reason;
        order.cancelledAt = new Date();

        if(order.paymentMethod=='UPI'|| order.paymentMethod === 'wallet'){
         let returnamount=order.finalAmount;
         let ordername =order.orderId
         
        let transaction={
            amount:returnamount,
            type:"credit", 
            description: `cancel fund from order ${ordername }`,
            date:new Date()}

            let walletUpdate=await Wallet.findOneAndUpdate({userId:userId},{ $inc: { balance:returnamount},
                $push: { transactions: transaction }})
            if(!walletUpdate){
            return res.status(404).json({
               success: false, 
               message: 'wallet not found' 
           });}



        }

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
        if(order.paymentMethod=='UPI'){
           return res.status(200).json({ 
                success: true, 
                message: 'Order cancelled successfully & money is refunded to your account' 
            });
        }

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
        console.log("Return order request initiated...");
        const userId = req.session.user;
        const { _id } = req.query;
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
        const order = await Order.findOne({ _id, userId });

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

        // Update order status and return details
        order.status = 'Request Return';
        order.returnReason = reason;
        order.returnedAt = new Date();

        // If payment was UPI, process wallet refund
        if (order.paymentMethod === 'UPI') {
            const returnAmount = order.finalAmount;
            const orderName = order.orderId;

            const transaction = {
                type: "credit", 
                description: `Return fund from order ${orderName}`,
                date: new Date()
            };

            const walletUpdate = await Wallet.findOneAndUpdate(
                { userId },
                { 
                    $inc: { balance: returnAmount },
                    $push: { transactions: transaction }
                },
                { new: true }
            );

            if (!walletUpdate) {
                return res.status(404).json({
                    success: false, 
                    message: 'Wallet not found'
                });
            }
        }

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
        const cart = await Cart.findOne({userId:userId})
        const wallet = await Wallet.findOne({userId:userId})
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
            wallet:wallet?wallet:[],
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
    applyCoupon,
    generateInvoice
};