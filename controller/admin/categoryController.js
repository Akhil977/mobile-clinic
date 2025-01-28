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
  
  const addCategoryOffer = async (req, res) => {
    try {
        console.log("just cheacking add category is working")
      const percentage = parseInt(req.body.percentage);
      const categoryId = req.body.categoryId;
  
      const category = await Category.findById(categoryId);
      if (!category) {
        return res
          .status(404)
          .json({ status: false, message: 'Category not found' });
      }
  
      const products = await Product.find({ category: category._id });
  
      const hasHigherProductOffer = products.some(
        (product) => product.productOffer > percentage
      );
      if (hasHigherProductOffer) {
        return res.status(400).json({
          status: false,
          message: 'Cannot add category offer. A higher product offer exists.',
        });
      }
  
      await Category.updateOne(
        { _id: categoryId },
        { $set: { CategoryOffer: percentage } }
      );
  
      // Update sale price for all products in the category
      for (const product of products) {
        const highestOffer = Math.max(percentage, product.productOffer);
        product.salePrice =
          product.regularPrice - (product.regularPrice * highestOffer) / 100;
        await product.save();
      }
  
      res.json({ status: true, message: 'Category offer added successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: 'Internal server error' });
    }
  };
  
  const removeCategoryOffer = async (req, res) => {
    try {
      const categoryId = req.body.categoryId;
  
      const category = await Category.findById(categoryId);
      if (!category) {
        return res
          .status(404)
          .json({ status: false, message: 'Category not found' });
      }
  
      const percentage = category.CategoryOffer;
      const products = await Product.find({ category: category._id });
  
      category.CategoryOffer = 0;
      await category.save();
  
      for (const product of products) {
        const highestOffer = product.productOffer;
        if (highestOffer === 0) {
          product.salePrice = product.salePrice;
        } else {
          product.salePrice =
            product.regularPrice - (product.regularPrice * highestOffer) / 100;
        }
        await product.save();
      }
  
      res.json({ status: true, message: 'Category offer removed successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: 'Internal server error' });
    }
  };
  
  const getListCategory = async (req, res) => {
    try {
      let id = req.query.id;
      await Category.updateOne({ _id: id }, { $set: { isListed: false } });
      res.redirect('/admin/category');
    } catch (error) {
      res.redirect('/pageError');
    }
  };
  
  const getUnlistCategory = async (req, res) => {
    try {
      let id = req.query.id;
      await Category.updateOne({ _id: id }, { $set: { isListed: true } });
      res.redirect('/admin/category');
    } catch (error) {
      res.redirect('/pageError');
    }
  };
  const getEditCategory = async (req, res) => {
    try {
      let id = req.query.id;
      const category = await Category.findOne({ _id: id });
      res.render('editCategory', { category: category });
    } catch (error) {
      res.redirect('/pageerror');
    }
  };
  const editCategory = async (req, res) => {
    try {
      let id = req.params.id;
      const { categoryName, description } = req.body;
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') }, // Case-insensitive match
        _id: { $ne: id }
      });
      if (existingCategory) {
        console.log("hi")
        return res
          .status(400)
          .json({ error: 'Category exists, please choose another name' });
      }
      const updateCategory = await Category.findByIdAndUpdate(
        id,
        {
          name: categoryName,
          description: description,
        },
        { new: true }
      );
  
      if (updateCategory) {
        return res.status(200).json({ success: 'Category updated successfully' });
      } else {
        res.status(404).json({ error: 'Category not found' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
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
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    toggleCategory 
  };
  