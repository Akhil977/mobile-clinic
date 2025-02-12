const bcrypt = require('bcryptjs');
const env = require("dotenv").config();
const nodemailer =require('nodemailer')
const User = require("../../model/userSchema")
const Product= require('../../model/productShema')
const Cart = require("../../model/cartSchema")
const pageNotFound = async (req,res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomepage = async (req, res) => {
    try {
        // Log session data for debugging
        console.log("Session data:", req.session);

        // Fetch all products that are listed for sale
        const products = await Product.find({ isListed: true });

        // Fetch the user's cart (only if logged in)
        let cart = [];
        if (req.session.isLoggedIn) {
            // Ensure userId is passed in the session correctly
            const userId = req.session.user; 

            // Fetch the cart and populate product details
            const userCart = await Cart.findOne({ userId: userId }).populate('item.productId');
            
            // If the cart exists, map cart items and include product details
            if (userCart) {
                cart = userCart.item.map(item => ({
                    productId: item.productId._id,  // Product ID
                    name: item.productId.productName,  // Product Name
                    price: item.price,  // Price of the item in the cart
                    quantity: item.quantity,  // Quantity of the item
                    totalPrice: item.totalPrice,  // Calculated total price of the item
                    image: item.productId.productImages[0]  // Image of the product
                }));
            }
        }

        // Check if the user is logged in (boolean flag for frontend)
        const isLoggedIn = req.session.isLoggedIn || false;

        // Render the homepage with products and the user's cart
        res.render("home", { isLoggedIn, cart, products });

    } catch (error) {
        console.error("Error loading homepage:", error.message);
        res.status(500).send("Server error");
    }
};
const loadLogin = (req, res) => {
    try {
        // Simulate session data (you can adjust this based on actual session management)
        req.session.sessionId = req.session.sessionId || "dummy-session-id";
        req.session.isLoggedIn = req.session.isLoggedIn || false;  // Default to false (logged out)

        // Get the success message from session
        const successMessage = req.session.successMessage;
        const errorMessage = req.session.errorMessage;  // You may also handle error messages

        // Clear the success and error messages after rendering
        req.session.successMessage = undefined;
        

        // Pass session data, isLoggedIn, and messages to the login page
        res.render('login', {
            isLoggedIn: req.session.isLoggedIn,  // Pass the session login status to the template
            cart: [],  // Temporary empty cart for now
            successMessage: successMessage || '', // If success message exists, show it
            errorMessage: errorMessage || '', // If error message exists, show it
            message: successMessage ||  '' // General message (either success or error)
        });
    } catch (error) {
        console.log("Error loading login page:", error.message);
        res.status(500).send("Server error");
    }
};
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();  // Corrected OTP generation
}

async function sendVerificationEmail(email, otp) {
    try {
        const transport = nodemailer.createTransport({
            service: 'gmail',  // Corrected "gamil" to "gmail"
            port: 587,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,  // Use environment variables for email & password
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        // Send the email using the transport object
        const info = await transport.sendMail({
            from: process.env.NODEMAILER_EMAIL,  // Correctly use the transport object to send the mail
            to: email,
            subject: "Verify your account",
            text: `Your OTP is: ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });

        // Check if the email was accepted
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;  // Return false if email sending fails
    }
}

const signup = async (req, res) => {
    const { name, email, phone, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !confirmPassword) {
        return res.json({
            errorMessage: 'All fields are required.'
        });
    }

    // Check if name contains only spaces
    if (name.trim().length === 0) {
        return res.json({
            errorMessage: 'Name cannot contain only spaces.'
        });
    }

    // Check if name starts with a number or special character
    if (/^[^a-zA-Z]/.test(name)) {
        return res.json({
            errorMessage: 'Name must start with a letter.'
        });
    }

    // Validate name format (allowing only single spaces between characters)
    const nameRegex = /^[a-zA-Z]+(?:\s[a-zA-Z]+)*$/;
    if (!nameRegex.test(name.trim())) {
        return res.json({
            errorMessage: 'Name should contain only letters with single spaces between words.'
        });
    }

    // Validate name length after trimming
    if (name.trim().length < 2 || name.trim().length > 50) {
        return res.json({
            errorMessage: 'Name should be between 2-50 characters.'
        });
    }

    // Validate name has both first and last name
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 2) {
        return res.json({
            errorMessage: 'Please enter both first and last name.'
        });
    }

    // Validate each name part is at least 2 characters
    if (nameParts.some(part => part.length < 2)) {
        return res.json({
            errorMessage: 'Each name part should be at least 2 characters long.'
        });
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return res.json({
            errorMessage: 'Please enter a valid email address.'
        });
    }

    // Validate phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
        return res.json({
            errorMessage: 'Please enter a valid 10-digit phone number.'
        });
    }

    // Compare passwords
    if (password !== confirmPassword) {
        return res.json({
            errorMessage: 'Passwords do not match.'
        });
    }

    try {
        // Check if the email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({
                errorMessage: 'Email already exists.'
            });
        }

        // Generate OTP
        const otp = generateOtp();

        // Send OTP to the user
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json({
                errorMessage: 'Failed to send OTP. Please try again.'
            });
        }

        // Format the name (capitalize first letter of each part)
        const formattedName = nameParts
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');

        // Temporarily store user data and OTP in session
        req.session.userOtp = otp;
        req.session.tempUserData = { 
            name: formattedName, 
            email, 
            phone, 
            password 
        };

        console.log('OTP sent:', otp);

        // Redirect to OTP verification page
        return res.json({});   
    } catch (error) {
        console.log('Error during signup:', error);
        return res.status(500).json({
            errorMessage: 'Internal server error'
        });
    }
};
const verifyOtp = async (req, res) => {
    const otp = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4 + req.body.otp5 + req.body.otp6;

    console.log('Session OTP:', req.session.userOtp); // Check OTP stored in session
    console.log('Received OTP:', otp); // Check OTP received from form

    // Check if OTP matches
    if (otp !== req.session.userOtp) {
        console.log("OTP did not match.");
        return res.json({
            errorMessage: 'Invalid OTP. Please try again.'
        });
    }
    
    console.log("OTP matched!");

    // Proceed with saving user data if OTP matches
    try {
        const { name, email, phone, password } = req.session.tempUserData;

        // Hash the password and create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, phone, password: hashedPassword });

        // Save the new user
        await newUser.save();
        console.log('User data saved successfully.');

        // Clear session data only after successful user creation
        req.session.userOtp = null;
        req.session.tempUserData = null;

        // Send success response after user is saved
        return res.json({
            successMessage: 'Registration successful! You can now log in.'
        });
    } catch (error) {
        console.log('Error saving user data:', error);
        return res.status(500).json({
            errorMessage: 'Internal server error'
        });
    }
};
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;  // Ensure you have email in the request body

        if (!email) {
            return res.status(400).json({
                errorMessage: 'Email is required for OTP resend.'
            });
        }

        // Generate new OTP
        const otp = generateOtp();

        // Update session with the new OTP
        req.session.userOtp = otp;

        // Send OTP via email
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({
                errorMessage: 'Failed to send OTP. Please try again.'
            });
        }

        console.log('New OTP sent:', otp);  // Simulated OTP

        // Respond with success message
        return res.json({ message: 'OTP has been resent to your email.' });
    } catch (error) {
        console.log('Error during OTP resend:', error);
        return res.status(500).json({
            errorMessage: 'An error occurred while resending the OTP. Please try again.'
        });
    }
};


const log = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const findUser = await User.findOne({email: email });
        
        if (!findUser) {
            return res.json({ success: false, message: "User not found" });
        }
        
        if (findUser.isBlocked) {
            return res.json({ success: false, message: "User is blocked by admin" });
        }
        
        const passwordMatch = await bcrypt.compare(password, findUser.password);
        
        if (!passwordMatch) {
            return res.json({ success: false, message: "Incorrect password" });
        }
        
        // Set session data
        req.session.isLoggedIn = true;
        req.session.user = findUser._id;
        
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session:", err);
                return res.json({ success: false, message: "Login failed. Please try again later." });
            }
            console.log("Login successful. User ID:", req.session.user);
            res.json({ success: true });
        });
    } catch (error) {
        console.error("Login error", error);
        res.json({ success: false, message: "Login failed. Please try again later." });
    }
};

const logout = async (req, res) => {
    // Check if the user is logged in
    if (req.session.isLoggedIn) {
        // Remove only the user-related session data
        delete req.session.user;
        delete req.session.isLoggedIn ;

        // Save the session after removing the user part
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session after removing user data:", err);
                return res.status(500).send("Unable to log out");
            }
            res.redirect("/login"); // Redirect to login page after user logout
        });
    } else {
        res.redirect("/"); // Redirect to home page if no user session found
    }
};

const adminBlocked= async(req,res)=>{
    try {
        res.render("blocked")
    } catch (error) {
        console.error("error in loading blocked.ejs");
    }
}

module.exports={
    loadHomepage,
    pageNotFound,
   
    loadLogin,
    signup,
    verifyOtp,
    resendOtp,log
    ,logout,
    adminBlocked
   
}