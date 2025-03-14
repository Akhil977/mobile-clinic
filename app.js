const express = require("express");
const app = express();
const path = require("path")
const env = require("dotenv").config();
const db = require("./config/db")
const session = require('express-session');
const passport= require("./config/passport")
const userRouter=require("./routes/userRouter")
const adminrouter = require('./routes/adminRouter')
db()


app.use(
    session({
        secret: process.env.SESSION_SECRET, // Replace with a secure, random string
        resave: false,            // Don't save session if unmodified
        saveUninitialized: false,  // Save new sessions even if not modified
        cookie: { secure: false ,
            httpOnly:true

        } // Set true if using HTTPS
    })
);
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});
app.use(passport.initialize());
app.use(passport.session());


app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname, "public")));

app.use("/",userRouter);
app.use('/admin',adminrouter);
app.listen(process.env.PORT,()=>{
    console.log("server running")
})
module.exports=app;