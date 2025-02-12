const Category = require('../../model/categorySchema');
const Product = require("../../model/productShema");
const mongoose = require('mongoose');
const categoryInfo = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 3;
      const skip = (page - 1) * limit;
  
      const categoryData = await Category.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      const totalCategories = await Category.countDocuments();
      const totalPages = Math.ceil(totalCategories / limit);
      res.render('category', {
        cat: categoryData,
        totalPages,
        currentPage: page,
      });
    } catch (error) {
      res.redirect('/pageError');
    }
  };
  const addCategory = async (req, res) => {
    const { name, description } = req.body;
    console.log("its insdie the catregory",name,description);
    try {
        console.log("its insdie the catregory",name,description);
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
      });
      if (existingCategory) {
        return res.status(400).json({ error: 'Category already exists' });
      }
      const newCategory = new Category({
        name,
        description,
      });
      await newCategory.save();
      return res.json({ message: 'Category added successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  };



  const getEditCategory = async (req, res) => {
    try {
      console.log("getEditCategory")
        const category = await Category.findById(req.query.id);
        if (!category) {
            return res.status(404);
        }
        res.render('editcategory', { category }); // Ensure correct view name
    } catch (error) {
        res.status(500).render('admin/error', { message: 'Server Error' });
    }
};

// Update category
const updateCategory = async (req, res) => {
    try {
      console.log("updateCategory")
        const { name, description } = req.body;
        const categoryId = req.params.id;

        // Check for duplicate category name (excluding current category)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: categoryId }
        });

        if (existingCategory) {
            return res.status(400).json({ error: 'Category name already exists' });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name, description },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};
  
 
  
  const getListCategory = async (req, res) => {
    try {
      let id = req.query.id;
      await Category.updateOne({ _id: id }, { $set: { isListed: false } });
      await Product.updateMany({category:id },{$set:{isListed:false}})
      res.redirect('/admin/category');
    } catch (error) {
      res.redirect('/pageError');
    }
  };
  
  const getUnlistCategory = async (req, res) => {
    try {
      let id = req.query.id;


      await Category.updateOne({ _id: id }, { $set: { isListed: true } });
      await Product.updateMany({category:id },{$set:{isListed:true}})
      res.redirect('/admin/category');
    } catch (error) {
      res.redirect('/pageError');
    }
  };
  


  const toggleCategory = async (req, res) => {
    try {
       const { id } = req.params
       const category = await Category.findById(id)
       if (!category) {
          return res.status(404).json({ success: false, message: "Category not found" })
       }
       category.isListed = !category.isListed
       await category.save()
       return res.status(200).json({ success: true, message: "Category updated successfully" })
    } catch (error) {
       console.log('error toggling category', error);
       return res.status(500).json({ message: "Internal server error" })
    }
 }
  module.exports = {
    categoryInfo,
    addCategory,
   
    getListCategory,
    getUnlistCategory,
    
    
    toggleCategory,
    updateCategory,getEditCategory
   
    
  };
  