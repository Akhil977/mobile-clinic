const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema({
    productName: {
       type: String,
       required: true,
       unique: true, // Prevent duplicate product names
    },
    regularPrice: {
       type: Number,
       required: true,
    },
    salePrice: {
       type: Number,
       required: true,
    },
    description: {
       type: String,
       required: true,
    },
    category: {
       type: Schema.Types.ObjectId,
       ref: "Category",
       required: true,
    },
    quantity: {
       type: Number,
       default: 0, // Default quantity is 0
    },
    productImages: [{ 
       type: String,
       required: true,
    }],
    brand: {
       type: String,
       default: "Unknown", // Default value set to "Unknown"
    },
    createdAt: {
       type: Date,
       default: Date.now,
    },
    isListed: {
       type: Boolean,
       default: false,
    },
    status: {
       type: String,
       enum: ["available", "out of stock", "Discontinued"],
       required: true,
       default: "available",
    },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;