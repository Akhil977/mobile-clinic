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
   
}, {
    collection: 'users'
});

const User = mongoose.model('User', userSchema);
module.exports = User;
