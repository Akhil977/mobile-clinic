const Wallet= require("../../model/walletSchema");
const User= require("../../model/userSchema");
const Cart = require("../../model/cartSchema")

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
   
   wallet = await Wallet.findByIdAndUpdate(walletId, { $set: { balance: total }},{ new:true } );
   if(wallet){
    return res.json({
        success: true,
        newBalance: wallet.balance  // Correct way
    });
    
    
}
   
} catch (error) {
    
}
}
module.exports={
    getWallet,
    addmoney
}