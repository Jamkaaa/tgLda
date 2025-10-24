let express = require("express");
const multer = require("multer");
const path = require("path");
const userController = require("./controllers/userController");
const followController = require("./controllers/followController");
const eventController = require("./controllers/eventController");
const friendController = require("./controllers/friendController");
const notificationController = require("./controllers/notificationController");
const chatController = require("./controllers/chatController");
const router = express.Router();

// Multer configuration for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Зөвхөн зураг файл оруулна уу (jpeg, jpg, png, gif)"));
  },
});

router.get("/", userController.home);
router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userController.logout);

// Profile routes
router.get(
  "/profile/:username",
  userController.checkUserExists,
  followController.checkFollow,
  friendController.checkFriendship,
  userController.viewProfile
);

router.get(
  "/profile/:username/joined-events",
  userController.checkUserExists,
  followController.checkFollow,
  friendController.checkFriendship,
  userController.viewProfileJoinedEvents
);

router.get(
  "/profile/:username/followers",
  userController.checkUserExists,
  followController.checkFollow,
  friendController.checkFriendship,
  followController.profileFollowers
);

router.get(
  "/profile/:username/following",
  userController.checkUserExists,
  followController.checkFollow,
  friendController.checkFriendship,
  followController.profileFollowing
);

router.get(
  "/profile/:username/friends",
  userController.checkUserExists,
  followController.checkFollow,
  friendController.checkFriendship,
  friendController.viewProfileFriends
);

router.post(
  "/follow/:username",
  userController.checkLogin,
  followController.follow
);

router.post(
  "/unfollow/:username",
  userController.checkLogin,
  followController.unfollow
);

router.get(
  "/profile/:username/followers",
  userController.checkUserExists,
  followController.checkFollow,
  followController.profileFollowers
);

router.get(
  "/profile/:username/following",
  userController.checkUserExists,
  followController.checkFollow,
  followController.profileFollowing
);

router.post("/doesUsernameExist", userController.doesUsernameExist);
router.post("/doesEmailExist", userController.doesEmailExist);

// Event routes
router.get(
  "/create-event",
  userController.checkLogin,
  eventController.viewCreateEvent
);
router.post(
  "/create-event",
  userController.checkLogin,
  eventController.createEvent
);
router.get("/event/:id", eventController.viewSingleEvent);
router.get(
  "/event/:id/edit",
  userController.checkLogin,
  eventController.viewEditEvent
);
router.post(
  "/event/:id/edit",
  userController.checkLogin,
  eventController.edit
);
router.post(
  "/event/:id/delete",
  userController.checkLogin,
  eventController.delete
);
router.post(
  "/event/:id/join",
  userController.checkLogin,
  eventController.joinEvent
);
router.post(
  "/event/:id/leave",
  userController.checkLogin,
  eventController.leaveEvent
);
router.get("/events", eventController.viewAllEvents);

// Friend routes
router.get("/friends", userController.checkLogin, friendController.viewFriends);
router.post(
  "/friend/add/:userId/:username",
  userController.checkLogin,
  friendController.sendRequest
);
router.post(
  "/friend/accept/:requestId",
  userController.checkLogin,
  friendController.acceptRequest
);
router.post(
  "/friend/reject/:requestId",
  userController.checkLogin,
  friendController.rejectRequest
);
router.post(
  "/friend/remove/:userId",
  userController.checkLogin,
  friendController.removeFriend
);

// Notification routes
router.get(
  "/api/notifications",
  userController.checkLogin,
  notificationController.getNotifications
);

// Chat routes
router.get(
  "/api/chats",
  userController.checkLogin,
  chatController.getRecentChats
);

// Profile edit routes
router.get(
  "/edit-profile",
  userController.checkLogin,
  userController.viewEditProfile
);

router.post(
  "/edit-profile",
  userController.checkLogin,
  upload.single("avatar"),
  userController.updateProfile
);

module.exports = router;
