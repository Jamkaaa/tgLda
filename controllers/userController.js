const Event = require("../models/Event");
let User = require("../models/User");

exports.checkLogin = function (req, res, next) {
  console.log("🔍 CheckLogin - Session:", req.session);
  console.log("🔍 CheckLogin - User:", req.session.user);
  
  if (req.session.user) {
    next();
  } else {
    req.flash("errors", "Та нэвтэрсэн байх шаардлагатай");
    req.session.save(function () {
      res.redirect("/");
    });
  }
};

exports.logout = function (req, res) {
  req.session.destroy(function () {
    res.redirect("/");
  });
};

exports.home = async function (req, res) {
  if (req.session.user) {
    // Get recent events
    let events = await Event.getAllEvents(req.session.user._id);
    // Show only first 5 events on dashboard
    let recentEvents = events.slice(0, 5);

    res.render("home-dashboard", { events: recentEvents });
    return;
  } else {
    res.render("home-guest");
  }
};

exports.login = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then(function (result) {
      req.session.user = { username: user.data.username, _id: user._id };
      req.session.save(function () {
        res.redirect("/");
      });
    })
    .catch(function (err) {
      req.flash("errors", err);
      res.redirect("/");
    });
};

exports.register = function (req, res) {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
      req.session.user = { username: user.data.username, _id: user._id };
      req.session.save(function () {
        res.redirect("/");
      });
    })
    .catch((errors) => {
      console.log("🚀 ~ errors:", errors);
      req.flash("errors", errors);
      req.session.save(function () {
        res.redirect("/");
      });
    });
};

exports.checkUserExists = function (req, res, next) {
  User.findByUsername(req.params.username)
    .then(function (userDocument) {
      // viewProfile руу дамжуулж өгнө
      req.profileUser = userDocument;
      next();
    })
    .catch(function () {
      res.render("404");
    });
};

exports.viewProfile = async function (req, res) {
  try {
    let events = await Event.findByAuthorId(req.profileUser._id);
    let joinedEvents = await Event.findJoinedEventsByUserId(req.profileUser._id);
    res.render("profile-events", {
      currentPage: "events",
      eventCount: events.length,
      joinedEventCount: joinedEvents.length,
      followerCount: req.followerCount,
      followingCount: req.followingCount,
      friendCount: req.friendCount,
      isFollowing: req.isFollowing,
      areFriends: req.areFriends || false,
      events: events,
      profileUsername: req.profileUser.username,
      profileUserId: req.profileUser._id.toString(),
      profileAvatar: req.profileUser.avatar
    });
  } catch {
    res.render("404");
  }
};

exports.viewProfileJoinedEvents = async function (req, res) {
  try {
    let events = await Event.findByAuthorId(req.profileUser._id);
    let joinedEvents = await Event.findJoinedEventsByUserId(req.profileUser._id);
    res.render("profile-joined-events", {
      currentPage: "joined-events",
      eventCount: events.length,
      joinedEventCount: joinedEvents.length,
      followerCount: req.followerCount,
      followingCount: req.followingCount,
      friendCount: req.friendCount,
      isFollowing: req.isFollowing,
      areFriends: req.areFriends || false,
      joinedEvents: joinedEvents,
      profileUsername: req.profileUser.username,
      profileUserId: req.profileUser._id.toString(),
      profileAvatar: req.profileUser.avatar
    });
  } catch {
    res.render("404");
  }
};

exports.doesUsernameExist = function (req, res) {
  User.findByUsername(req.body.username)
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.doesEmailExist = function (req, res) {
  User.doesEmailExist(req.body.email)
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

// View edit profile page
exports.viewEditProfile = function (req, res) {
  res.render("edit-profile", {
    title: "Профайл засах",
    user: req.session.user
  });
};

// Update profile
exports.updateProfile = async function (req, res) {
  try {
    const updates = {
      bio: req.body.bio || "",
      location: req.body.location || "",
      website: req.body.website || ""
    };

    // If profile picture was uploaded
    if (req.file) {
      updates.avatar = `/uploads/${req.file.filename}`;
    }

    await User.updateProfile(req.session.user._id, updates);

    // Update session avatar if changed
    if (updates.avatar) {
      req.session.user.avatar = updates.avatar;
    }

    req.flash("success", "Профайл амжилттай шинэчлэгдлээ!");
    res.redirect(`/profile/${req.session.user.username}`);
  } catch (error) {
    console.log("❌ Update profile error:", error);
    req.flash("errors", "Профайл шинэчлэхэд алдаа гарлаа");
    res.redirect("/edit-profile");
  }
};
