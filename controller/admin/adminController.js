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
        let periodFilter = {};
        let labels = [];
        
        // Get current date info
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Set up time filter and labels based on period
        if (period === "daily") {
            // For daily data, show last 7 days
            const last7Days = new Date();
            last7Days.setDate(last7Days.getDate() - 6); // 7 days ago
            
            periodFilter = { 
                createdAt: { 
                    $gte: new Date(last7Days.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                } 
            };
            
            // Create labels for the last 7 days
            labels = [];
            for (let i = 6; i >= 0; i--) {
                const day = new Date();
                day.setDate(day.getDate() - i);
                labels.push(day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })); // e.g. "Mon 1"
            }
        } else if (period === "weekly") {
            // For weekly data, show last 12 weeks
            const last12Weeks = new Date();
            last12Weeks.setDate(last12Weeks.getDate() - 84); // 12 weeks ago
            
            periodFilter = { 
                createdAt: { 
                    $gte: new Date(last12Weeks.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999)) 
                } 
            };
            
            // Create labels for the last 12 weeks
            labels = [];
            for (let i = 11; i >= 0; i--) {
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - (7 * i));
                labels.push(`Week ${Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)}`);
            }
        } else if (period === "yearly") {
            // For yearly data, show last 5 years
            periodFilter = {};
            labels = [currentYear-4, currentYear-3, currentYear-2, currentYear-1, currentYear].map(String);
        } else {
            // Default: monthly (show all months of current year)
            periodFilter = {
                createdAt: {
                    $gte: new Date(currentYear, 0, 1),
                    $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999)
                }
            };
            labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        }

        // Count totals (these remain the same regardless of period)
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalProducts = await Product.countDocuments();
        
        // Apply period filter to orders
        const orderFilter = { ...periodFilter };
        if (period === "daily" || period === "weekly") {
            // For daily/weekly views, we include all orders for the summary metrics
            const orders = await Order.find({ status: "Delivered", ...orderFilter });
            const totalRevenue = orders.reduce((acc, order) => acc + (order.finalAmount || 0), 0);
            const totalOrders = orders.length;
            
            // For daily view - aggregate by day
            let timeData;
            if (period === "daily") {
                timeData = await Order.aggregate([
                    { $match: { status: "Delivered", ...orderFilter } },
                    {
                        $group: {
                            _id: { 
                                year: { $year: "$createdAt" },
                                month: { $month: "$createdAt" },
                                day: { $dayOfMonth: "$createdAt" }
                            },
                            total: { $sum: "$finalAmount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
                ]);
            } else {
                // For weekly view - aggregate by week
                timeData = await Order.aggregate([
                    { $match: { status: "Delivered", ...orderFilter } },
                    {
                        $group: {
                            _id: { 
                                year: { $year: "$createdAt" },
                                week: { $week: "$createdAt" }
                            },
                            total: { $sum: "$finalAmount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id.year": 1, "_id.week": 1 } }
                ]);
            }
            
            // Initialize arrays based on the period
            const dataPoints = labels.length;
            const salesData = Array(dataPoints).fill(0);
            const orderCounts = Array(dataPoints).fill(0);
            
            if (period === "daily") {
                // Map daily data to the last 7 days
                timeData.forEach(item => {
                    const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                    const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                    
                    if (daysAgo >= 0 && daysAgo < 7) {
                        const index = 6 - daysAgo; // Reverse index (today is at the end)
                        salesData[index] = item.total;
                        orderCounts[index] = item.count;
                    }
                });
            } else {
                // Map weekly data to the last 12 weeks
                timeData.forEach(item => {
                    const yearWeek = `${item._id.year}-${item._id.week}`;
                    const currentWeek = `${now.getFullYear()}-${Math.ceil((now.getDate() + now.getDay()) / 7)}`;
                    const weeksAgo = getWeeksDifference(yearWeek, currentWeek);
                    
                    if (weeksAgo >= 0 && weeksAgo < 12) {
                        const index = 11 - weeksAgo; // Reverse index (current week at the end)
                        salesData[index] = item.total;
                        orderCounts[index] = item.count;
                    }
                });
            }
            
            return generateDashboardResponse(res, totalRevenue, totalOrders, totalProducts, totalUsers, 
                          labels, salesData, orderCounts, period);
        } else if (period === "yearly") {
            // For yearly view - aggregate by year
            const yearlyData = await Order.aggregate([
                { $match: { status: "Delivered" } },
                {
                    $group: {
                        _id: { year: { $year: "$createdAt" } },
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1 } }
            ]);
            
            const salesData = Array(5).fill(0);
            const orderCounts = Array(5).fill(0);
            
            yearlyData.forEach(item => {
                const yearIndex = labels.indexOf(item._id.year.toString());
                if (yearIndex !== -1) {
                    salesData[yearIndex] = item.total;
                    orderCounts[yearIndex] = item.count;
                }
            });
            
            const orders = await Order.find({ status: "Delivered" });
            const totalRevenue = orders.reduce((acc, order) => acc + (order.finalAmount || 0), 0);
            const totalOrders = await Order.countDocuments();
            
            return generateDashboardResponse(res, totalRevenue, totalOrders, totalProducts, totalUsers, 
                          labels, salesData, orderCounts, period);
        } else {
            // Default monthly view (current year by month)
            const monthlyData = await Order.aggregate([
                { 
                    $match: { 
                        status: "Delivered", 
                        createdAt: { 
                            $gte: new Date(currentYear, 0, 1),
                            $lte: new Date(currentYear, 11, 31, 23, 59, 59, 999)
                        }
                    } 
                },
                {
                    $group: {
                        _id: { month: { $month: "$createdAt" } },
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.month": 1 } }
            ]);
            
            const salesData = Array(12).fill(0);
            const orderCounts = Array(12).fill(0);
            
            monthlyData.forEach(item => {
                salesData[item._id.month - 1] = item.total;
                orderCounts[item._id.month - 1] = item.count;
            });
            
            const orders = await Order.find({ status: "Delivered" });
            const totalRevenue = orders.reduce((acc, order) => acc + (order.finalAmount || 0), 0);
            const totalOrders = await Order.countDocuments();
            
            return generateDashboardResponse(res, totalRevenue, totalOrders, totalProducts, totalUsers, 
                          labels, salesData, orderCounts, period);
        }
    } catch (error) {
        console.error("Dashboard Error:", error.message, error.stack);
        res.status(500).json({ error: "Error loading dashboard data" });
    }
};

// Helper function to generate the dashboard response
function generateDashboardResponse(res, totalRevenue, totalOrders, totalProducts, totalUsers, 
                                 labels, salesData, orderCounts, period) {
    // Fetch additional data needed for all periods
    return Promise.all([
        // Category performance
        Order.aggregate([
            { $unwind: "$orderedItems" },
            { $lookup: { from: "products", localField: "orderedItems.product", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $lookup: { from: "categories", localField: "product.category", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $group: { _id: "$category.name", total: { $sum: "$orderedItems.price" } } }
        ]),
        
        // Best selling products
        Order.aggregate([
            { $unwind: "$orderedItems" },
            { $group: { _id: "$orderedItems.product", totalQuantity: { $sum: "$orderedItems.quantity" }, totalRevenue: { $sum: "$orderedItems.price" } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" }
        ]),
        
        // Recent orders
        Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("userId", "name")
            .select("orderId totalPrice status createdAt")
    ]).then(([categoryPerformance, bestSelling, recentOrders]) => {
        res.json({
            summary: { revenue: `₹${totalRevenue.toLocaleString()}`, orders: totalOrders },
            stats: { products: totalProducts, users: totalUsers },
            sales: { labels, revenue: salesData, orders: orderCounts },
            categories: { 
                labels: categoryPerformance.map((cp) => cp._id), 
                data: categoryPerformance.map((cp) => cp.total) 
            },
            bestSelling: bestSelling.map((bs) => ({
                product: bs.product.productName,
                price: `₹${bs.product.salePrice.toLocaleString()}`,
                sold: bs.totalQuantity,
            })),
            topPerformers: {
                brand: { name: "TBD", sales: 0 },
                category: { 
                    name: categoryPerformance[0]?._id || "N/A", 
                    sales: categoryPerformance[0]?.total || 0 
                },
            },
            recentOrders: recentOrders.map((order) => ({
                orderId: order.orderId,
                customer: order.userId?.name || "Unknown",
                product: "Multiple",
                date: order.createdAt.toLocaleDateString(),
                amount: `₹${order.totalPrice.toLocaleString()}`,
                status: order.status,
            })),
            period  // Return the period to the frontend for reference
        });
    });
}

// Helper function to calculate weeks difference
function getWeeksDifference(week1, week2) {
    const [year1, weekNum1] = week1.split('-').map(Number);
    const [year2, weekNum2] = week2.split('-').map(Number);
    
    const yearDiff = (year2 - year1) * 52;
    return yearDiff + (weekNum2 - weekNum1);
}

// Export both controller functions

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