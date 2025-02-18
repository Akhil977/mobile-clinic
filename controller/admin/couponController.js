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

const addCoupon = async(req,res)=>{
    try {
        console.log("its insidethe addcoupon controller")
        const {name,couponType,expireOn,offerPrice,maximumDiscountAmount,minimumPrice,usageLimit}=req.body;
        const existingCoupon = await Coupon.findOne({name:name});
        if(existingCoupon){
            return res.status(400).json({
                success:false,
                message:"coupon with name already exist"
            })
        }
        const result = await Coupon.create({name,couponType,expireOn,offerPrice,maximumDiscountAmount,minimumPrice,usageLimit})
       
        res.status(200).json({
            success:true,
            message:'Coupon added success',
        })
    } catch (error) {
        console.error("Error in addCoupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add coupon"
        });
    }
}

const getCouponById = async(req,res)=>{
    try {
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        res.status(200).json({
            success: true,
            coupon
        });
    } catch (error) {
        console.error("Error in getCouponById:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupon details"
        });
    }
}

const editCoupon = async(req,res)=>{
    try {
        console.log("its inside the edit")
        const couponId = req.params.id;
        const {
            name,
            couponType,
            expireOn,
            offerPrice,
            maximumDiscountAmount,
            minimumPrice,
            usageLimit
        } = req.body;

        // Check if another coupon exists with the same name (excluding current coupon)
        const existingCoupon = await Coupon.findOne({
            name: name,
            _id: { $ne: couponId }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Another coupon with this name already exists"
            });
        }

        const updateData = {
            name,
            couponType,
            expireOn,
            offerPrice,
            minimumPrice,
            usageLimit
        };

        // Only include maximumDiscountAmount for percentage coupons
        if (couponType === 'percentage') {
            updateData.maximumDiscountAmount = maximumDiscountAmount;
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon: updatedCoupon
        });
    } catch (error) {
        console.error("Error in editCoupon:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update coupon"
        });
    }
}

const toggleCouponStatus = async(req,res)=>{
    try {
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        // Toggle the status using findByIdAndUpdate to avoid validation
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            { $set: { islist: !coupon.islist } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: `Coupon ${updatedCoupon.islist ? 'activated' : 'deactivated'} successfully`,
            islist: updatedCoupon.islist
        });
    } catch (error) {
        console.error("Error in toggleCouponStatus:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle coupon status"
        });
    }
}

module.exports={
    getCoupon,
    addCoupon,
    getCouponById,
    editCoupon,
    toggleCouponStatus
}