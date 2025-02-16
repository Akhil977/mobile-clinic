const Brand = require('../../model/brandschema');
const Product = require("../../model/productShema")
const mongoose = require('mongoose');

const brandInfo = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 3;
      const skip = (page - 1) * limit;
  
      const brandData = await Brand.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      const totalBrands = await Brand.countDocuments();
      const totalPages = Math.ceil(totalBrands / limit);
      res.render('brand', {
        brands: brandData,
        totalPages,
        currentPage: page,
      });
    } catch (error) {
      res.redirect('/pageError');
    }
  };

const addBrand = async (req, res) => {
    const { brandName,brandDescription } = req.body;
    console.log("Adding brand", brandName);
    try {
        const existingBrand = await Brand.findOne({
            brandName: { $regex: new RegExp(`^${brandName}$`, 'i') },
        });
        if (existingBrand) {
            return res.status(400).json({ error: 'Brand already exists' });
        }
        const newBrand = new Brand({
            brandName,
        });
        await newBrand.save();
        return res.json({ message: 'Brand added successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getEditBrand = async (req, res) => {
    try {
        console.log("getEditBrand");
        const brand = await Brand.findById(req.query.id);
        if (!brand) {
            return res.status(404);
        }
        res.render('editbrand', { brand });
    } catch (error) {
        res.status(500).render('admin/error', { message: 'Server Error' });
    }
};

const updateBrand = async (req, res) => {
    try {
        console.log("updateBrand");
        const { brandName } = req.body;
        const brandId = req.params.id;

        const existingBrand = await Brand.findOne({
            brandName: { $regex: new RegExp(`^${brandName}$`, 'i') },
            _id: { $ne: brandId }
        });

        if (existingBrand) {
            return res.status(400).json({ error: 'Brand name already exists' });
        }

        const updatedBrand = await Brand.findByIdAndUpdate(
            brandId,
            { brandName },
            { new: true, runValidators: true }
        );

        if (!updatedBrand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        res.json({ message: 'Brand updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};

const getListBrand = async (req, res) => {
    try {
        let id = req.query.id;
        const brand = await Brand.findOne({_id: id})
        await Brand.updateOne({ _id: id }, { $set: {  isBlocked: false } });
        await Product.updateMany({brand:brand.brandName },{$set:{isListed:true}})
        res.redirect('/admin/brand');
    } catch (error) {
        res.redirect('/pageError');
    }
};

const getUnlistBrand = async (req, res) => {
    try {
        let id = req.query.id;
        const brand = await Brand.findOne({_id: id})
        
        console.log(` how cheacking can as access the name ${brand.brandName}` )
        console.log(`its inside the unblocked${id}`)
        await Brand.updateOne({ _id: id }, { $set: {  isBlocked: true } });
       
        await Product.updateMany({brand:brand.brandName },{$set:{isListed:false}})
       
        res.redirect('/admin/brand');
    } catch (error) {
        res.redirect('/pageError');
    }
};

const toggleBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ success: false, message: "Brand not found" });
        }
        brand.isBlocked = !brand.isBlocked;
        await brand.save();
        return res.status(200).json({ success: true, message: "Brand updated successfully" });
    } catch (error) {
        console.log('Error toggling brand', error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    brandInfo,
    addBrand,
    getListBrand,
    getUnlistBrand,
    toggleBrand,
    updateBrand,
    getEditBrand
};
