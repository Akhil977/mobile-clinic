const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: false,
        sparse: true,
        default: null
    },
    phone:{
        type:String,
        require:false,
        unique:false,
        sparse:true
    },
    googleId: {
        type: String,
        unique: true,
        sparse:true,
        
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    // cart: [{
    //     type: Schema.Types.ObjectId,
    //     ref: "Cart"
    // }],
    // wallet: [{
    //     type: Schema.Types.ObjectId,
    //     ref: "Wishlist" // Corrected to "Wishlist" for consistency
    // }],
    // orderHistory: [{
    //     type: Schema.Types.ObjectId,
    //     ref: "Order"
    // }],
    createdOn: {
        type: Date,
        default: Date.now
    },
    referralCode: { // Corrected "referalCode" to "referralCode"
        type: Boolean
    },
    redeemedUser: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    // searchHistory: [{
    //     category: {
    //         type: Schema.Types.ObjectId,
    //         ref: "Category"
    //     },
    //     brand: {
    //         type: String
    //     },
        // searchOn: {
        //     type: Date,
        //     default: Date.now
        // }
    // }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
