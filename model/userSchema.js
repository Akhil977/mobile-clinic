const mongoose = require("mongoose");
const { search } = require("../routes/userRouter");
const {schema}= mongoose;

const userSchema =new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
type:String,
required:true,
unique:false,
sparse:true,
default:null
    },
    googleId:{
        type:String,
        unique:true
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart",
    }],wallet:[{
        type:Schema.Types.ObjectId,
        ref:"wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:Boolean
    },
    redeemedUser:[{
        type: Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})
const User= mongoose.model("User",userSchema);
module.exports = User;