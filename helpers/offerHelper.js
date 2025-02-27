const Category=require("../model/categorySchema");
const Product =require("../model/productShema");


const applyBestOffer = async () => {
    try {
        const categories = await Category.find({}, "_id CategoryOffer expireOn");

        const categoryOfferMap = categories.reduce((map, category) => {
            const isExpired = category.expireOn && category.expireOn < Date.now();
            map[category._id.toString()] = isExpired ? 0 : category.CategoryOffer || 0;
            return map;
        }, {});

        const products = await Product.find({}, "_id category regularPrice productOffers expireOn salePrice finalOffer");

        const bulkUpdates = products.map(product => {
            const categoryOffer = categoryOfferMap[product.category.toString()] || 0;
            const productOffer = product.productOffers || 0;
            const isProductOfferExpired = product.expireOn && product.expireOn < Date.now();
            const effectiveProductOffer = isProductOfferExpired ? 0 : productOffer;

            // Give priority to category offer if it's greater or equal
            const bestOffer = categoryOffer >= effectiveProductOffer ? categoryOffer : effectiveProductOffer;
            const discountAmount = (product.regularPrice * bestOffer) / 100;
            const discountedPrice = Math.round(product.regularPrice - discountAmount);
            const discountDifference = product.regularPrice - discountedPrice;

            return {
                updateOne: {
                    filter: { _id: product._id },
                    update: { 
                        finalOffer: bestOffer,
                        salePrice: discountedPrice,
                        savedAmount: discountDifference, 
                    }
                }
            };
        });

        if (bulkUpdates.length > 0) {
            await Product.bulkWrite(bulkUpdates);
        }
    } catch (error) {
        console.error("Error applying best offer:", error);
    }
};

module.exports={applyBestOffer};