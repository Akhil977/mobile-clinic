const User = require("../../model/userSchema");
const Address = require("../../model/addressSchema")
const nodemailer = require("nodemailer");
const bcrypt = require('bcryptjs');
const env = require("dotenv").config();
const session = require("express-session");
const Cart = require("../../model/cartSchema");


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
    cart={};
    const isLoggedIn = req.session.isLoggedIn || false; 
    try {
        res.render("forgot-password",{cart,isLoggedIn});
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
    const isLoggedIn = req.session.isLoggedIn || false; 

    res.render('restPassword',{isLoggedIn})
}

const  restPassword = async (req, res) => {
    try {
        const password = req.body.newPassword;
        const email = req.session.email;
        console.log(password);
        console.log(req.session.email);

        const hashedPassword = bcrypt.hashSync(password, 10);
        await User.updateOne({ email: email }, { $set: { password: hashedPassword } });

        // Determine redirection route based on session user existence
        let redirectTo = req.session.user ? "/profile" : "/login";

        res.status(200).json({
            status: 'success',
            message: "Password updated successfully",
            redirectTo: redirectTo
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'error',
            message: "Error with password updating"
        });
    }
};

const getprofile = async(req,res)=>{

    const cart={};
   
    const isLoggedIn = req.session.isLoggedIn || false; 
    const user = await User.findOne({_id:req.session.user})
res.render("userdetalils",{cart,isLoggedIn,user})
}

const getaddress =async(req,res)=>{
    const cart = {};
    const isLoggedIn = req.session.isLoggedIn || false; 
    const user = req.session.user||"5672354762547625";
    const addressDoc = await Address.findOne({ userId: req.session.user });
    const addresses = addressDoc ? addressDoc.address : [];
  
    
    try {
        res.render("address",{cart,isLoggedIn,addresses})
    } catch (error) {
        
    }
}
const getaddaddress = async (req, res) => {
    const cart = {};
    const isLoggedIn = req.session.isLoggedIn || false; 
    const user = await User.findOne({ userId: req.session.user });

    const addressId = req.query.id; // Get address ID from query parameter (for edit mode)
    let address = null;

    if (addressId) {
        // Editing mode: Fetch specific address by ID
         const addressDoc = await Address.findOne({ userId: req.session.user });
    }

    res.render("addaddress", { cart, isLoggedIn, user, address });
};

const geteditaddress = async(req,res)=>{
    try {
        const cart = {}; // Populate cart data if necessary
        const isLoggedIn = req.session.isLoggedIn || false; 
        const user = req.session.user; // Assuming user info is stored in the session

        // Fetch the user's address document
        const addressDoc = await Address.findOne({ userId: user });
        if (!addressDoc) {
            return res.status(404).send('Address not found.');
        }

        // Find the address by the query parameter id (if exists)
        const addressId = req.query.id;
        let address = null;

        if (addressId) {
            address = addressDoc.address.id(addressId); // Use Mongoose method to find the address by ID in the array
            if (!address) {
                return res.status(404).send('Address not found or you do not have permission to edit it.');
            }
        }

        res.render('editaddress', { cart, isLoggedIn, user, address });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong, please try again later.');
    }
};

const posteditaddress= async(req,res)=>{
    try {
        const user = req.session.user; // Get the current user from session
        const addressId = req.params.id; // Get the address ID from the URL parameter

        if (!addressId) {
            return res.status(400).send('Address ID is required.');
        }

        // Fetch the user's address document
        const addressDoc = await Address.findOne({ userId: user });
        if (!addressDoc) {
            return res.status(404).send('Address not found.');
        }

        // Find the specific address within the address array
        const address = addressDoc.address.id(addressId);
        if (!address) {
            return res.status(404).send('Address not found or you do not have permission to edit it.');
        }

        // Update the address fields with the new data from the form (req.body)
        address.addressType = req.body.addressType || address.addressType;
        address.name = req.body.name || address.name;
        address.city = req.body.city || address.city;
        address.landMark = req.body.landMark || address.landMark;
        address.state = req.body.state || address.state;
        address.pincode = req.body.pincode || address.pincode;
        address.phone = req.body.phone || address.phone;
        address.altPhone = req.body.altPhone || address.altPhone;

        // Save the updated address document
        await addressDoc.save();

        // Redirect the user to the page where they can view the updated address list
        res.redirect('/user-address'); // Adjust the redirect path as necessary
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong, please try again later.');
    }
};

const addaddress = async(req,res)=>{
    try{
    const userid = req.session.user;
    const{addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body;
    const userAddress = await Address.findOne({userId:req.session.user})
    if(!userAddress){
        const newAddress = new Address({
            userId:userid,
            address:[{addressType,name,city,landMark,state,pincode,phone,altPhone}] 
            

        })
        await newAddress.save();
    }else{
        userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
        await userAddress.save();
    }
    res.redirect("/user-address");

}catch(error){
    console.error("error adding Address",error);
}}


const deleteaddress=async(req,res)=>{
    try {
        console.log("delete is working")
        const addressId = req.params.id;
        console.log(addressId)
        const updatedAddress = await Address.findOneAndUpdate(
            { userId:req.session.user },
            { $pull: { address: { _id: addressId } } }
        );
        res.status(200).json({ success: true, message: 'Address deleted successfully' }); 
    } catch (error) {
        
    }
}

const updateProfile =async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        // Validation
        if (name && name.trim().length < 2) {
            return res.status(400).json({ message: 'Name must be at least 2 characters long' });
        }

        if (phone && !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ message: 'Phone must be 10 digits' });
        }

        // Find and update user
        const user = await User.findById(req.session.user);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only update fields that were sent
        if (name) user.name = name;
        if (phone) user.phone = phone;

        await user.save();

        // Return updated user data
        res.json({
            name: user.name,
            phone: user.phone,
            email: user.email
        });

    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

const checkOldPassword = async(req,res)=>{
try {
 const check =req.body.oldPassword;
 console.log(check)
 const user = await User.findById(req.session.user)
 console.log(user.name)
 const isMatch = await bcrypt.compare(check, user.password);
 if (!isMatch) return res.status(401).json({ error: 'Invalid password' });
 if(isMatch){
 return res.json({ verified: true });
 }
 console.log(isMatch)
} catch (error) {
    
}
}
const updatePassword = async(req,res)=>{
    try{
    
    const newPassword = req.body.newPassword;
    const userID= req.session.user;
    const hashedPassword = bcrypt.hashSync(newPassword,10);
    await User.findByIdAndUpdate(userID, { password: hashedPassword });

    return res.status(200).json({ message: 'Password updated successfully' });

} catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update password22121' });
}


}



module.exports = {
    getForgotPasspage,
    forgotEmailValid,
    getforgototp,
    validatingotp,
    getRestPassword,
    restPassword,
    getprofile,
    getaddress,
    updateProfile,
    checkOldPassword,
    updatePassword,
    getaddaddress,
    addaddress,deleteaddress,geteditaddress
    ,posteditaddress
};
