const User = require("../../model/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require('bcryptjs');
const env = require("dotenv").config();
const session = require("express-session");

// Debug: Log environment variables to ensure they're loaded correctly
if (env.error) {
    console.log("Error loading .env file", env.error);
} else {
    console.log("Environment variables loaded successfully");
    console.log('Email:', process.env.NODEMAILER_EMAIL); // Debugging log
    console.log('Password:', process.env.NODEMAILER_PASSWORD); // Debugging log
}

// Send verification email
const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4></b>`,
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        return true;
    } catch (error) {
        console.error("Error sending email:", error); // Log actual error message
        return false;
    }
};

// Function to generate OTP
function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

// Forgot password page
const getForgotPasspage = async (req, res) => {
    try {
        res.render("forgot-password");
    } catch (error) {
        console.error("Error rendering forgot password page:", error);
    }
};

// Handle email validation and send OTP

const forgotEmailValid = async (req, res) => {
    try {
        console.log("forgotEmailValid called");
        console.log("Request body:", req.body);
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        const findUser = await User.findOne({ email: email });
        console.log("User found:", findUser ? 'Yes' : 'No');

        if (!findUser) {
            return res.status(404).json({
                status: 'error',
                message: 'User with this email does not exist.'
            });
        }

        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        try {
            const emailSent = await sendVerificationEmail(email, otp);
            console.log("Email sent status:", emailSent);

            if (emailSent) {
                // Store OTP in session
                req.session.userOtp = otp;
                req.session.email = email;
                console.log("Session data:", req.session);

                return res.status(200).json({
                    status: 'success',
                    message: 'OTP sent successfully'
                });
            } else {
                return res.status(500).json({
                    status: 'error',
                    message: 'Error sending email, please try again later.'
                });
            }
        } catch (emailError) {
            console.error("Email sending error:", emailError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send verification email.'
            });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        return res.status(500).json({
            status: 'error',
            message: 'An unexpected error occurred.'
        });
    }
};
const getforgototp = async(req,res)=>{
    try {
        res.render("forgot-otp")
    } catch (error) {
        
    }
}

const validatingotp= async(req,res)=>{
const otp =req.body.otp;
console.log(`this is the otp u typed${otp}`);
console.log(`this is the session otp  ${req.session.userOtp}`)

if(otp==req.session.userOtp){
    res.status(200).json({
        status:'success',
        message:"otp matched"
    })
}else{
    res.status(400).json({
        status:'error',
        message:"otp doesnot matched"
    })
}

}


const getRestPassword= async(req,res)=>{
    res.render('restPassword')
}

const restPassword= async(req,res)=>{
    try{
    password =req.body.newPassword;
    const email= req.session.email;
    console.log(password);
    console.log(req.session.email)
    const hashedPassword = bcrypt.hashSync(password,10);
    await User.updateOne({ email: email },{$set:{ 
        password:hashedPassword}})
        res.status(200).json({
             status:'success',
        message:"password updated successfully"
        })
    }catch(error){
        console.error(error)
res.status(500).json({
    status:'error',
    message:"error with password updating"
})
    }
}

const getprofile = async(req,res)=>{
    const cart={};
   
    const isLoggedIn = req.session.isLoggedIn || false; 
res.render("userdetalils",{cart,isLoggedIn})
}



module.exports = {
    getForgotPasspage,
    forgotEmailValid,
    getforgototp,
    validatingotp,
    getRestPassword,
    restPassword,
    getprofile
};
