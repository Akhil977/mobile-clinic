const express = require("express");
const app = express();
const path = require("path")
const env = require("dotenv").config();
const db = require("./config/db")
const session = require('express-session');
const passport= require("./config/passport")
const userRouter=require("./routes/userRouter")
db()
app.use(
    session({
        secret: process.env.SESSION_SECRET, // Replace with a secure, random string
        resave: false,            // Don't save session if unmodified
        saveUninitialized: true,  // Save new sessions even if not modified
        cookie: { secure: false ,
            httpOnly:true

        } // Set true if using HTTPS
    })
);
app.use(passport.initialize());
app.use(passport.session());


app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname, "public")));

app.use("/",userRouter);
app.listen(process.env.PORT,()=>{
    console.log("server running")
})
module.exports=app;