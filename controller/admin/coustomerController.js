const User = require("../../model/userSchema");

const customerInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = req.query.page;
        }

        const limit = 6;
        const UserData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        }).countDocuments();

        res.render('userManagement', {
            data: UserData,
            totalpages: Math.ceil(count / limit),
            currentpage: page,
        });
    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(500).send("Internal Server Error");
    }
};

const blockUnblockCustomer = async (req, res) => {
    try {
        const userId = req.body.id; // Use req.body.id to get the user ID from the form

        if (!userId) {
            return res.status(400).send("User ID is required");
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("User not found");
        }

        user.isBlocked = !user.isBlocked; // Toggle the blocked status

        await user.save();

        res.redirect("/admin/userManagement"); // Redirect back to the user management page
    } catch (error) {
        console.error("Error blocking/unblocking customer:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    customerInfo,
    blockUnblockCustomer,
};