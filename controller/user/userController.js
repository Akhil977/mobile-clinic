const bcrypt = require('bcryptjs');
const env = require("dotenv").config();
const nodemailer =require('nodemailer')
const User = require("../../model/userSchema")
const pageNotFound = async (req,res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomepage = async (req, res) => {
    try {
        // Example: Dummy cart data and session simulation
        const cart = [
            { productId: 1, name: "Product A", price: 10, quantity: 2 },
            { productId: 2, name: "Product B", price: 20, quantity: 1 },
        ];

        // Simulate session data for testing
        req.session.sessionId = req.session.sessionId || "dummy-session-id";
        req.session.isLoggedIn = req.session.isLoggedIn || false; // Simulate logged-out by default

        // Pass the cart and session data to the EJS template
        res.render("home", { 
            cart, 
            sessionId: req.session.sessionId, 
            isLoggedIn: req.session.isLoggedIn 
        });
    } catch (error) {
        console.error("Home page not found:", error.message);
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
    const { name, email, phonenumber, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !email || !phonenumber || !password || !confirmPassword) {
        return res.json({
            errorMessage: 'All fields are required.'
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
    if (!phoneRegex.test(phonenumber)) {
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

        // Temporarily store user data and OTP in session
        req.session.userOtp = otp;
        req.session.tempUserData = { name, email, phonenumber, password };

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
        const { name, email, phonenumber, password } = req.session.tempUserData;

        // Hash the password and create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, phonenumber, password: hashedPassword });

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




module.exports={
    loadHomepage,
    pageNotFound,
   
    loadLogin,
    signup,
    verifyOtp,
    resendOtp
   
}