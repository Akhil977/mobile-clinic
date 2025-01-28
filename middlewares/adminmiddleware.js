const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        return res.redirect("/admin"); // Redirect to the dashboard if already logged in
    }
    next();
};

const adminCheck = (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect("/admin/login"); // Redirect to login if not logged in
    }
    next();
};

module.exports = { adminAuth, adminCheck };