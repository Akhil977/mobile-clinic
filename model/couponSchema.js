const mongoose = require("mongoose");
const User = require("./userSchema");
const {Schema}= mongoose;
const couponSchema =new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
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
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
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
const Coupon = mongoose.model("Coupon",couponSchema);
module.exports= Coupon;