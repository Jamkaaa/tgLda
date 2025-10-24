let express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const markdown = require("marked");
const sanitizeHTML = require("sanitize-html");
let app = express();

let sessionOptions = session({
  secret: "javascript",
  // store: MongoStore.create({ client: require("./db") }),
  store: MongoStore.create({
    mongoUrl: process.env.CONNECTION_STRING,
    dbName: "MySocialApp",
    collectionName: "sessions",
  }),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 * 60 * 24, httpOnly: true, sameSite: "strict" },
});

app.use(sessionOptions);

app.use(flash());

let router = require("./router.js");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set("views", "./views");
app.set("view engine", "ejs");
app.use(express.static("public"));

// Энэ хэсэг router холбох мөрийн заавал дээр байх ёстой
app.use(function (req, res, next) {
  res.locals.filterUserHTML = function (content) {
    return sanitizeHTML(markdown.parse(content), {
      allowedTags: ["p", "strong", "a", "ul", "li"],
      allowedAttributes: {},
    });
  };
  res.locals.errors = req.flash("errors");
  res.locals.success = req.flash("success");

  res.locals.user = req.session.user;
  next();
});

app.use("/", router);

const server = require("http").createServer(app);
const io = require("socket.io")(server);

// Make io available in controllers
app.set("io", io);

// express session-ийг socket.io дээр ашиглах middleware үүсгэж байна
io.use(function (socket, next) {
  sessionOptions(socket.request, socket.request.res || {}, next);
});

// Store connected users with their socket IDs
const connectedUsers = new Map(); // username -> socket.id

// Make connectedUsers accessible to other modules
app.set("connectedUsers", connectedUsers);

io.on("connection", (socket) => {
  if (socket.request.session.user) {
    let user = socket.request.session.user;
    
    // Store user's socket connection
    connectedUsers.set(user.username, socket.id);
    
    // Send welcome message with username
    socket.emit("welcome", { username: user.username });
    console.log("✅", user.username, "холбогдлоо... Socket ID:", socket.id);

    // Handle private messages
    socket.on("chatMessageFromBrowser", (data) => {
      const sanitizedMessage = sanitizeHTML(data.message, {
        allowedTags: [],
        allowedAttributes: {},
      });

      // Find recipient's socket
      const recipientSocketId = connectedUsers.get(data.toUsername);
      
      if (recipientSocketId) {
        // Send to specific user
        io.to(recipientSocketId).emit("chatMessageFromServer", {
          message: sanitizedMessage,
          username: user.username,
          userId: user._id.toString(),
          timestamp: new Date()
        });
        console.log("💬", user.username, "→", data.toUsername, ":", sanitizedMessage);
      } else {
        console.log("⚠️", data.toUsername, "холбогдоогүй байна");
      }

      // Save message to database (optional - for message history)
      // You can implement this later if you want persistent chat history
    });

    // Handle request for previous messages
    socket.on("requestPreviousMessages", (data) => {
      // For now, send empty array
      // Later you can implement database storage for chat history
      socket.emit("previousMessages", {
        friendUsername: data.friendUsername,
        messages: []
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      connectedUsers.delete(user.username);
      console.log("❌", user.username, "салав...");
      
      // Broadcast user offline status to all connected users
      socket.broadcast.emit("userOffline", { username: user.username });
    });
    
    // Broadcast user online status to all connected users
    socket.broadcast.emit("userOnline", { username: user.username });
  }
});

module.exports = server;
