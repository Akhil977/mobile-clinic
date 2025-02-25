const Wallet= require("../../model/walletSchema");
const User= require("../../model/userSchema");
const Cart = require("../../model/cartSchema");
const { session } = require("passport");

let getWallet= async(req,res)=>{
    try {
        const userId = req.session.user;
        console.log("Fetching orders for user ID:", userId);
          const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
          const isLoggedIn = req.session.isLoggedIn || false;
          let wallet = await Wallet.findOne({userId:userId})
          if(!wallet){
           
            wallet = await Wallet.create({ userId: userId, balance: 0 });
          }
            // If the cart exists, map cart items and include product details
            if (userCart) {
                cart = userCart.item.map(item => ({
                    productId: item.productId._id,  // Product ID
                    name: item.productId.productName,  // Product Name
                    price: item.price,  // Price of the item in the cart
                    quantity: item.quantity,  // Quantity of the item
                    totalPrice: item.totalPrice,  // Calculated total price of the item
                    image: item.productId.productImages[0]  // Image of the product
                }));
            }
        console.log(wallet.balance)
        res.render("wallet",{cart,isLoggedIn,wallet})
    } catch (error) {
        
    }
}


let addmoney=async(req,res)=>{
try {
    const{walletId,amount}=req.body;
    console.log(walletId);
    console.log(amount);
    let wallet= await Wallet.findById(walletId)
    let total=wallet.balance+amount;
   
    wallet = await Wallet.findByIdAndUpdate(
        walletId,
        {
            $inc: { balance: total }, // Increment balance by the total amount
            $push: {
                transactions: {
                    amount: total,
                    type: "credit",
                    description: `An amount of ${total} has been successfully credited by the account holder.`,
                    date: new Date()
                }
            }
        },
        { new: true }
    );
   if(wallet){
    return res.json({
        success: true,
        newBalance: wallet.balance  // Correct way
    });
    
    
}
   
} catch (error) {
    
}
}




const getHistory = async (req, res) => {
    try {
        const userId = req.session.user;
        let cart = []; // Initialize cart as empty array

        // Get user's cart if it exists
        const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
        
        // Add await here - this was missing
        const wallet = await Wallet.findOne({ userId: userId });
        
        const isLoggedIn = req.session.isLoggedIn || false;

        // Only process cart if userCart exists
        if (userCart && userCart.item) {
            cart = userCart.item.map(item => ({
                productId: item.productId._id,
                name: item.productId.productName,
                price: item.price,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                image: item.productId.productImages[0]
            }));
        }

        res.render("walletHistory", {
            wallet,
            isLoggedIn,
            cart
        });

    } catch (error) {
        console.error('Error in getHistory:', error);
        res.status(500).render('error', { 
            message: 'Error fetching wallet history',
            isLoggedIn: req.session.isLoggedIn || false 
        });
    }
};
module.exports={
    getWallet,
    addmoney,
    getHistory
}