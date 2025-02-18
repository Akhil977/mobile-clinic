const mongoose = require("mongoose");
const User = require("./userSchema");
const {Schema}= mongoose;
const couponSchema =new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    couponType: {
        type: String,
        required: true,
        enum: ['flat', 'percentage'],
        default: 'flat'
    },
    offerPrice:{
        type:Number,
        required:true,
        validate: {
            validator: function(value) {
                if (this.couponType === 'percentage') {
                    return value <= 100; 
                }
                return true;
            },
            message: 'Percentage discount cannot be more than 100%'
        }
    },
    maximumDiscountAmount: {
        type: Number,
        required: function() {
            return this.couponType === 'percentage'; 
        },
        min: 0,
        validate: {
            validator: function(value) {
                if (this.couponType === 'percentage' && (!value || value <= 0)) {
                    return false;
                }
                return true;
            },
            message: 'Maximum discount amount is required for percentage coupons and must be greater than 0'
        }
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    expireOn:{
        type:Date,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true,
        min: 0
    },
    usageLimit: {
        type: Number,
        required: true,
        min: 1
    },
    islist:{
        type:Boolean,
        default:true
    },
    UserId:[
        {
            type:mongoose.Schema.ObjectId,
            ref:"User"
        }
    ]
})

couponSchema.pre('save', function(next) {
    if (this.couponType === 'percentage') {
        if (this.offerPrice > 100) {
            next(new Error('Percentage discount cannot be more than 100%'));
        }
        if (!this.maximumDiscountAmount || this.maximumDiscountAmount <= 0) {
            next(new Error('Maximum discount amount is required for percentage coupons'));
        }
    }
    next();
});

const Coupon = mongoose.model("Coupon",couponSchema);
module.exports= Coupon;