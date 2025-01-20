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
    console.log(req.body);

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

    // Validate phone number (simple validation for a 10-digit number)
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
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({ 
                errorMessage: 'Email already exists.' 
            });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user with the hashed password
        const newUser = new User({ name, email, phonenumber, password: hashedPassword });
const otp = generateOtp();
        // Save the new user to the database
        await newUser.save();
        const emailSent = await sendVerificationEmail(email,otp);
        if(!emailSent){
            return res.json("email-error")
        }
        req.session.userOtp=otp;
        req.session.userData={email,password};
    
        // res.render("verify-otp");
        console.log('Otp send',otp)
        console.log("Data saved");

        // Return a success message
       res.redirect('/login')

    } catch (error) {
        console.log("Error for save user", error);
        return res.status(500).json({ 
            errorMessage: 'Internal server error' 
        });
    }
};



module.exports={
    loadHomepage,
    pageNotFound,
   
    loadLogin,
    signup
}