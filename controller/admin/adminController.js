const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Order = require("../../model/orderSchema"); // Adjust path to your Order model
const Product = require("../../model/productShema"); // Adjust path to your Product model
const User = require("../../model/userSchema");

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

const renderDashboardPage = (req, res) => {
    try {
        res.render('index'); // Adjust the path if needed
    } catch (error) {
        console.error("Dashboard Render Error:", error);
        res.status(500).render('error', { error: "Could not render dashboard" });
    }
};

// Function to load dashboard data as JSON
const loadDashboardData = async (req, res) => {
    try {
        const period = req.query.period || "monthly";
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
        let periodFilter = {};
        let labels = [];
        let startReference;

        console.log("Request Query:", { period, startDate, endDate });

        // Get current date info
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Define period filter and labels based on period
        if (period === "custom" && startDate && endDate) {
            if (isNaN(startDate) || isNaN(endDate) || startDate > endDate || endDate > now) {
                return res.status(400).json({ error: "Invalid date range" });
            }

            startReference = new Date(startDate);
            periodFilter = {
                createdAt: {
                    $gte: new Date(startDate.setHours(0, 0, 0, 0)),
                    $lte: new Date(endDate.setHours(23, 59, 59, 999)),
                },
            };

            const daysDiff = Math.ceil((endDate - startReference) / (1000 * 60 * 60 * 24));
            labels = [];
            for (let i = 0; i <= daysDiff; i++) {
                const date = new Date(startReference);
                date.setDate(startReference.getDate() + i);
                labels.push(date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }));
            }
        } else if (period === "weekly") {
            startReference = new Date(now);
            startReference.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
            startReference.setHours(0, 0, 0, 0);

            periodFilter = {
                createdAt: {
                    $gte: startReference,
                    $lte: new Date(now.setHours(23, 59, 59, 999)),
                },
            };

            labels = [];
            const daysInWeek = now.getDay() === 0 ? 6 : now.getDay();
            for (let i = 0; i <= daysInWeek; i++) {
                const day = new Date(startReference);
                day.setDate(startReference.getDate() + i);
                labels.push(day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }));
            }
        } else if (period === "monthly") {
            periodFilter = {
                createdAt: {
                    $gte: new Date(currentYear, currentMonth, 1),
                    $lte: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
                },
            };

            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            labels = [];
            for (let i = 1; i <= daysInMonth; i++) {
                labels.push(`${i}`);
            }
        } else if (period === "yearly") {
            periodFilter = {
                createdAt: {
                    $gte: new Date(currentYear - 4, 0, 1),
                    $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999),
                },
            };
            labels = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map(String);
        }

        // Count totals
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalProducts = await Product.countDocuments();

        // Apply period filter to orders
        const orderFilter = { status: "Delivered", ...periodFilter };
        const orders = await Order.find(orderFilter);
        const totalRevenue = orders.reduce((acc, order) => acc + (order.finalAmount || 0), 0);
        const totalOrders = orders.length;

        // Sales and Orders Data
        let salesData = [];
        let orderCounts = [];

        if (period === "custom" || period === "weekly") {
            const timeData = await Order.aggregate([
                { $match: orderFilter },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                        },
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            ]);

            const dataPoints = labels.length;
            salesData = Array(dataPoints).fill(0);
            orderCounts = Array(dataPoints).fill(0);

            timeData.forEach((item) => {
                const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                const daysFromStart = Math.floor((date - startReference) / (1000 * 60 * 60 * 24));
                if (daysFromStart >= 0 && daysFromStart < dataPoints) {
                    salesData[daysFromStart] = item.total;
                    orderCounts[daysFromStart] = item.count;
                }
            });
        } else if (period === "monthly") {
            const monthlyData = await Order.aggregate([
                { $match: orderFilter },
                {
                    $group: {
                        _id: { day: { $dayOfMonth: "$createdAt" } },
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { "_id.day": 1 } },
            ]);

            const dataPoints = labels.length;
            salesData = Array(dataPoints).fill(0);
            orderCounts = Array(dataPoints).fill(0);

            monthlyData.forEach((item) => {
                const dayIndex = item._id.day - 1;
                if (dayIndex >= 0 && dayIndex < dataPoints) {
                    salesData[dayIndex] = item.total;
                    orderCounts[dayIndex] = item.count;
                }
            });
        } else if (period === "yearly") {
            const yearlyData = await Order.aggregate([
                { $match: orderFilter },
                {
                    $group: {
                        _id: { year: { $year: "$createdAt" } },
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { "_id.year": 1 } },
            ]);

            salesData = Array(5).fill(0);
            orderCounts = Array(5).fill(0);

            yearlyData.forEach((item) => {
                const yearIndex = labels.indexOf(item._id.year.toString());
                if (yearIndex !== -1) {
                    salesData[yearIndex] = item.total;
                    orderCounts[yearIndex] = item.count;
                }
            });
        }

        // Generate dashboard response
        return generateDashboardResponse(
            res,
            totalRevenue,
            totalOrders,
            totalProducts,
            totalUsers,
            labels,
            salesData,
            orderCounts,
            period,
            periodFilter
        );
    } catch (error) {
        console.error("Dashboard Error:", error.message, error.stack);
        res.status(500).json({ error: "Error loading dashboard data" });
    }
};

const generateDashboardResponse = async (
    res,
    totalRevenue,
    totalOrders,
    totalProducts,
    totalUsers,
    labels,
    salesData,
    orderCounts,
    period,
    periodFilter
) => {
    const [categoryPerformance, bestSelling, recentOrders, brandPerformance] = await Promise.all([
        // Category Performance
        Order.aggregate([
            { $match: { status: "Delivered", ...periodFilter } },
            { $unwind: "$orderedItems" },
            { $lookup: { from: "products", localField: "orderedItems.product", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $lookup: { from: "categories", localField: "product.category", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $group: { _id: "$category.name", total: { $sum: "$orderedItems.price" } } },
            { $sort: { total: -1 } },
        ]),
        // Best Selling Products
        Order.aggregate([
            { $match: { status: "Delivered", ...periodFilter } },
            { $unwind: "$orderedItems" },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { $sum: "$orderedItems.price" },
                },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
        ]),
        // Recent Orders
        Order.find({ ...periodFilter })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("userId", "name")
            .select("orderId finalAmount status createdAt"),
        // Brand Performance
        Order.aggregate([
            { $match: { status: "Delivered", ...periodFilter } },
            { $unwind: "$orderedItems" },
            { $lookup: { from: "products", localField: "orderedItems.product", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.brand",
                    totalSales: { $sum: "$orderedItems.price" },
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 1 },
        ]),
    ]);

    const bestBrand = brandPerformance.length > 0
        ? { name: brandPerformance[0]._id || "No Brand", sales: brandPerformance[0].totalSales }
        : { name: "No Sales", sales: 0 };

    const bestCategory = categoryPerformance.length > 0
        ? { name: categoryPerformance[0]._id || "No Category", sales: categoryPerformance[0].total }
        : { name: "No Sales", sales: 0 };

    res.json({
        summary: { revenue: `₹${totalRevenue.toLocaleString()}`, orders: totalOrders },
        stats: { products: totalProducts, users: totalUsers },
        sales: { labels, revenue: salesData, orders: orderCounts },
        categories: {
            labels: categoryPerformance.map((cp) => cp._id || "Unknown"),
            data: categoryPerformance.map((cp) => cp.total),
        },
        bestSelling: bestSelling.map((bs) => ({
            product: bs.product.productName || "Unknown",
            price: `₹${(bs.product.salePrice || bs.totalRevenue).toLocaleString()}`,
            sold: bs.totalQuantity,
        })),
        topPerformers: {
            brand: bestBrand,
            category: bestCategory,
        },
        recentOrders: recentOrders.map((order) => ({
            orderId: order.orderId,
            customer: order.userId?.name || "Unknown",
            date: order.createdAt.toLocaleDateString(),
            amount: `₹${order.finalAmount.toLocaleString()}`,
            status: order.status,
        })),
        period,
    });
}

function getWeeksDifference(week1, week2) {
    const [year1, weekNum1] = week1.split('-').map(Number);
    const [year2, weekNum2] = week2.split('-').map(Number);
    const yearDiff = (year2 - year1) * 52;
    return yearDiff + (weekNum2 - weekNum1);
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
    
    loadCategory,
    adminLogout,
    loadUserManagement, renderDashboardPage,
    loadDashboardData,
}