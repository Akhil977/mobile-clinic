const Category=require("../model/categorySchema");
const Product =require("../model/productShema");


const applyBestOffer = async () => {
    try {
        // Fetch all categories with their offers and expiration dates
        const categories = await Category.find({}, "_id CategoryOffer expireOn");

        // Create a map of category IDs to their effective offers (0 if expired)
        const categoryOfferMap = categories.reduce((map, category) => {
            const isExpired = category.expireOn && category.expireOn < Date.now();
            map[category._id.toString()] = isExpired ? 0 : category.CategoryOffer || 0;
            return map;
        }, {});

        // Fetch all products with necessary fields
        const products = await Product.find({}, "_id category regularPrice productOffers expireOn salePrice finalOffer");

        // Process each product and determine the best offer
        const bulkUpdates = products.map(product => {
            const categoryOffer = categoryOfferMap[product.category.toString()] || 0;
            const productOffer = product.productOffers || 0;
            const isProductOfferExpired = product.expireOn && product.expireOn < Date.now();
            const effectiveProductOffer = isProductOfferExpired ? 0 : productOffer;

            // Prioritize product offer when equal; use category offer only if strictly greater
            let bestOffer;
            if (effectiveProductOffer > 0 && effectiveProductOffer >= categoryOffer) {
                bestOffer = effectiveProductOffer; // Product offer takes priority if equal or greater
            } else {
                bestOffer = categoryOffer; // Category offer only if strictly greater
            }

            // Calculate discounted price and savings
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

        // Execute bulk updates if there are any
        if (bulkUpdates.length > 0) {
            await Product.bulkWrite(bulkUpdates);
        }
    } catch (error) {
        console.error("Error applying best offer:", error);
    }
};

module.exports = { applyBestOffer };