const User = require("../../model/userSchema");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const loadlogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

     

        // Find admin user
        const admin = await User.findOne({isAdmin: true });
      

        if (admin) {
            // Compare password
            const passwordMatch = await bcrypt.compare(password, admin.password);
            console.log("Password match:", passwordMatch);

            if (passwordMatch) {
                // Set session
                req.session.admin = true;
            

                // Redirect to admin dashboard
                return res.redirect("/admin");
            } else {
                console.log("Password mismatch");
                return res.redirect("/login");
            }
        } else {
            console.log("Admin user not found");
            return res.redirect("/login");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Internal Server Error");
    }
};

const loadDashboard= async (req, res) => {
    // Dummy data
    const order = 100;  // Simulated order count
    const product = 50;  // Simulated product count
    const userCount = await User.countDocuments({});   // Simulated user count
    const contact = 30;  // Simulated contact count

    // Render the 'admin/index' view with dummy data
    res.render("index", {
        orders: order,
        product: product,
        user: userCount,
        contact: contact,
    });
}

const loadCategory =async (req, res) => {
	res.render("category");
};
const adminLogout = (req, res) => {
    if (req.session.admin) {
        delete req.session.admin; // Remove only the admin session data
    }
    res.redirect("/admin/login"); // Redirect to admin login page
};


const loadUserManagement = async (req, res) => {
    try {
        const users = await User.find(); // Fetch all users
        res.render("userManagement", { users }); // Render the page with user data
    } catch (error) {
        console.error("Error loading user management:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports ={
    loadlogin,
    login,
    loadDashboard,
    loadCategory,
    adminLogout,
    loadUserManagement
}