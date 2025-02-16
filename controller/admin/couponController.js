const Coupon = require("../../model/couponSchema")



const getCoupon = async(req,res)=>{
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        res.render("couponlisting", { coupons });
    } catch (error) {
        console.error("Error in getCoupon:", error);
        res.status(500).render("couponlisting", { 
            coupons: [],
            error: "Failed to fetch coupons"
        });
    }
}
module.exports={
    getCoupon
}