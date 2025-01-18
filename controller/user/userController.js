const pageNotFound = async (req,res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const loadHomepage = async (req, res) => {
    try {
        const cart = []; // Example cart data
        res.render("home", { cart }); // Pass the cart data to the view
    } catch (error) {
        console.log("Home page not found:", error.message);
        res.status(500).send("Server error");
    }
};
module.exports={
    loadHomepage,
    pageNotFound
}