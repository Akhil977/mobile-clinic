
const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    transactions: [
        {
            amount: Number,
            type: { type: String, enum: ["credit", "debit"] }, 
            description: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

const Wallet=mongoose.model("Wallet",walletSchema)
module.exports=Wallet;