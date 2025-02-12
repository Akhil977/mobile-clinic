const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
  
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product', 
            required: true
        },
        productName: {
            type: String,
            required: true,
        },
  
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Cancelled', 'Delivered','Request Return', 'Return Approved', 'Return Rejected', 'Return Completed'],
        default: 'Pending'
    },
 
    cancelReason: {
        type: String,
        required: false,
        default: null
    },
    returnReason: {
        type: String,
        required: false,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    returnedAt: {
        type: Date,
        default: null
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: [
            'Cash on Delivery',
            'Wallet Balance',
            'UPI Payment',
            'Credit/Debit Card'
        ]
    }
}, { 
    timestamps: true 
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;