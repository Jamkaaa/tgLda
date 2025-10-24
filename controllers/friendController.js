const Friend = require("../models/Friend");

// Send friend request
exports.sendRequest = function (req, res) {
  console.log("🔍 Send Friend Request - userId:", req.params.userId);
  console.log("🔍 Send Friend Request - username:", req.params.username);
  console.log("🔍 Send Friend Request - from:", req.session.user._id);
  console.log("🔍 Send Friend Request - session:", req.session.user);
  
  if (!req.session.user || !req.session.user._id) {
    req.flash("errors", "Та нэвтэрсэн байх шаардлагатай");
    return req.session.save(() => res.redirect("/"));
  }
  
  Friend.sendRequest(req.session.user._id, req.params.userId)
    .then(() => {
      req.flash("success", "Найзын хүсэлт илгээлээ!");
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    })
    .catch((error) => {
      console.log("❌ Friend Request Error:", error);
      req.flash("errors", error);
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    });
};

// Accept friend request
exports.acceptRequest = function (req, res) {
  Friend.acceptRequest(req.params.requestId, req.session.user._id)
    .then(() => {
      req.flash("success", "Найзын хүсэлтийг хүлээн авлаа!");
      req.session.save(() => res.redirect("/friends"));
    })
    .catch((error) => {
      req.flash("errors", error);
      req.session.save(() => res.redirect("/friends"));
    });
};

// Reject friend request
exports.rejectRequest = function (req, res) {
  Friend.rejectRequest(req.params.requestId, req.session.user._id)
    .then(() => {
      req.flash("success", "Найзын хүсэлтийг татгалзлаа.");
      req.session.save(() => res.redirect("/friends"));
    })
    .catch((error) => {
      req.flash("errors", error);
      req.session.save(() => res.redirect("/friends"));
    });
};

// Remove friend
exports.removeFriend = function (req, res) {
  Friend.removeFriend(req.session.user._id, req.params.userId)
    .then(() => {
      req.flash("success", "Найзаас хаслаа.");
      req.session.save(() => res.redirect("/friends"));
    })
    .catch((error) => {
      req.flash("errors", error);
      req.session.save(() => res.redirect("/friends"));
    });
};

// View friends page
exports.viewFriends = async function (req, res) {
  try {
    let friends = await Friend.getFriendsList(req.session.user._id);
    let pendingRequests = await Friend.getPendingRequests(req.session.user._id);
    let sentRequests = await Friend.getSentRequests(req.session.user._id);

    res.render("friends", {
      friends: friends,
      pendingRequests: pendingRequests,
      sentRequests: sentRequests,
      title: "Найзууд"
    });
  } catch (error) {
    req.flash("errors", "Найзуудыг ачааллахад алдаа гарлаа.");
    res.redirect("/");
  }
};

// View profile friends
exports.viewProfileFriends = async function (req, res) {
  try {
    let friends = await Friend.getFriendsList(req.profileUser._id);

    res.render("profile-friends", {
      currentPage: "friends",
      eventCount: req.eventCount,
      joinedEventCount: req.joinedEventCount,
      followerCount: req.followerCount,
      followingCount: req.followingCount,
      friendCount: req.friendCount,
      isFollowing: req.isFollowing,
      areFriends: req.areFriends || false,
      friends: friends,
      profileUsername: req.profileUser.username,
      profileUserId: req.profileUser._id.toString(),
    });
  } catch (error) {
    req.flash("errors", "Найзуудыг ачааллахад алдаа гарлаа.");
    res.redirect("/");
  }
};

// Check if users are friends (middleware)
exports.checkFriendship = async function (req, res, next) {
  try {
    req.areFriends = await Friend.areFriends(
      req.profileUser._id,
      req.session.user ? req.session.user._id : null
    );
    next();
  } catch (error) {
    req.areFriends = false;
    next();
  }
};
