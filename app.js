const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config();


const storage = multer.memoryStorage(); // Store the file as a buffer in memory

// Create the Multer upload instance
const upload = multer({ storage: storage });

const app = express();

// Middleware for parsing form data
app.use(express.urlencoded({ extended: false }));

// Mongoose setup
mongoose.connect(process.env.MONGODB_URL, ).then(()=>{
    console.log("connection established")
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'static' directory
app.use(express.static(path.join(__dirname, 'images')));

// Create a user schema
const userSchema = new mongoose.Schema({
    user_id: String,
    name: String,
    age: String,
    city: String,
    nationality: String,
    img_path: String,
    created_at: String,
    updated_at: [String]
});

// Create a user model
const User = mongoose.model('User', userSchema);

// Function to load users from MongoDB
const loadUsers = async () => {
    try {
        const users = await User.find().sort({ created_at: 'desc' });
        return users;
    } catch (error) {
        console.error('Error loading users:', error.message);
        return [];
    }
};

// Function to save users to MongoDB
const saveUsers = async (users) => {
    try {
        await User.insertMany(users);
    } catch (error) {
        console.error('Error saving users:', error.message);
    }
};

// Show all users
app.get('/', async (req, res) => {
    const users = await loadUsers();
    res.render('allUser', { users });
});

app.get('/addUser',async (req, res) => {
    res.render('addUserForm');
})

// 'addUser' route
app.post('/addUser', upload.single('uploadImage'), async (req, res) => {
    const { name, age, city, nationality } = req.body;

    // Validate other fields as needed

    const user_id = Date.now().toString();
    let img_path;

    if (req.file) {
        const buffer = req.file.buffer;
        const extension = path.extname(req.file.originalname);
        img_path = `images/${user_id}${extension}`;

        if (!fs.existsSync('images')) {
            fs.mkdirSync('images');
            console.log('Created images folder');
        }

        try {
            fs.writeFileSync(img_path, buffer);
            console.log('Image successfully written to', img_path);
        } catch (error) {
            console.error('Error writing image:', error);
        }
        img_path = `${user_id}${extension}`
    } else {
        img_path = 'default-image.jpg';
        console.log("default");
    }

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString('en-US', {
        timeZone: 'IST',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    const newUser = new User({
        user_id,
        name,
        age,
        city,
        nationality,
        img_path,
        created_at: formattedDate,
        updated_at: []
    });

    // const users = await loadUsers();
    // users.push(newUser);
    // await saveUsers(users);

    await newUser.save();


    res.redirect('/');
});

// Show user details of particular user.
app.get('/user/:user_id', async (req, res) => {
    const user_id = req.params.user_id;
    const user = await User.findOne({user_id: user_id});

    if (!user) {
        // Handle user not found
        res.send('User not found');
    } else {
        res.render('user', { user });
    }
});

// Show edit user form
app.get('/editUser/:user_id',async (req, res) => {
    const user_id = req.params.user_id;
    const user = await User.findOne({user_id: user_id})

    if (!user) {
        // Handle user not found
        res.send('User not found');
    } else {
        res.render('updateUserForm', { user });
    }
});

app.post('/editUser/:user_id', upload.single('image'), async (req, res) => {
    try {
        const user_id = req.params.user_id;
        const { name, age, city, nationality } = req.body;

        let img_path;

        if (req.file) {
            // unlink old file
            try {
                const oldPath = await User.findOne({ user_id: user_id }).exec();
                console.log(oldPath.img_path)
                fs.unlinkSync(path.join(__dirname, 'images', oldPath.img_path));
            } catch (error) {
                console.error('Error deleting old image:', error);
            };
            // Handle file upload
            const buffer = req.file.buffer;
            const extension = path.extname(req.file.originalname);
            img_path = `${Date.now().toString()}${extension}`; // Using user_id as a unique identifier

            // Write file to disk
            fs.writeFileSync(path.join(__dirname,'images',img_path), buffer);

        } else {
            // If no file uploaded, keep the existing image path
            const existingUser = await User.findOne({ user_id });
            if (existingUser) {
                img_path = existingUser.img_path;
            } else {
                throw new Error('User not found');
            }
        }

        // Update user data
        const updatedUser = await User.findOneAndUpdate(
            { user_id },
            { name, age, city, nationality, img_path, $push: { updated_at: new Date().toLocaleString('en-US', {
                timeZone: 'IST',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }) } },
            { new: true }
        );

        if (!updatedUser) {
            throw new Error('User not found');
        }

        // Redirect to the user details page
        res.redirect(`/user/${user_id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/deleteUser/:user_id',async (req, res) => {
    const user_id = req.params.user_id;

    // Load existing users
    let users = await User.findOne({ user_id: user_id }).exec();
    if(!users){
        console.log('Not Found!!')
        return res.status(404).json({message:'No such user'})
    }

    // Find the user to delete it's image;
    const img_path = users.img_path

    // Filter out the user to delete
    await  User.deleteOne({ user_id: user_id }).exec()

    fs.unlinkSync(__dirname + '/images/' + img_path)

    // Redirect to the home page
    res.redirect('/');
});

app.get('*',(req,res) => {
    res.render('404')
})

app.listen(process.env.PORT || 7000, () => {
    console.log('http://localhost:8000');
});
