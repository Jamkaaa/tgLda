const { post } = require("../app");
const Follow = require("../models/Follow");
const Event = require("../models/Event");

exports.follow = function (req, res) {
  let follow = new Follow(req.params.username, req.session.user._id);
  follow
    .create()
    .then(() => {
      req.flash("success", `Та ${req.params.username} -г дагалаа `);
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    })
    .catch(() => {
      req.flash("errors", "Алдаа гарлаа, дахин оролдоно уу");
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    });
};

exports.unfollow = function (req, res) {
  if (req.isFollowing === false) {
    req.flash(
      "errors",
      "Та энэ хэрэглэгчийг дагаагүй тул unfollow хийх боломжгүй байна"
    );
    req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    return;
  }

  let follow = new Follow(req.params.username, req.session.user._id);
  follow
    .delete()
    .then(() => {
      req.flash("success", `Та ${req.params.username} -г дагахаа больлоо `);
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    })
    .catch(() => {
      req.flash("errors", "Алдаа гарлаа, дахин оролдоно уу");
      req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    });
};

exports.checkFollow = async function (req, res, next) {
  req.isFollowing = false;
  if (req.session.user) {
    try {
      req.isFollowing = await Follow.isUserFollowing(
        req.profileUser._id,
        req.session.user._id
      );
      console.log("🚀 ~ req.isFollowing :", req.isFollowing);
    } catch {
      req.isFollowing = false;
    }
  }

  let eventCountPromise = Event.findByAuthorId(req.profileUser._id);
  let joinedEventCountPromise = Event.findJoinedEventsByUserId(req.profileUser._id);
  let followerCountPromise = Follow.countFollowersByUserId(req.profileUser._id);
  let followingCountPromise = Follow.countFollowingByUserId(
    req.profileUser._id
  );
  let friendCountPromise = require("../models/Friend").countFriends(req.profileUser._id);

  let results = await Promise.all([
    eventCountPromise,
    joinedEventCountPromise,
    followerCountPromise,
    followingCountPromise,
    friendCountPromise,
  ]);

  req.eventCount = results[0].length;
  req.joinedEventCount = results[1].length;
  req.followerCount = results[2];
  req.followingCount = results[3];
  req.friendCount = results[4];

  next();
};

exports.profileFollowers = async function (req, res) {
  Follow.findFollowersByUserId(req.profileUser._id)
    .then(function (followers) {
      res.render("profile-followers", {
        eventCount: req.eventCount,
        joinedEventCount: req.joinedEventCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount,
        friendCount: req.friendCount,
        currentPage: "followers",
        isFollowing: req.isFollowing,
        areFriends: req.areFriends || false,
        followers: followers,
        profileUsername: req.profileUser.username,
        profileUserId: req.profileUser._id.toString(),
      });
    })
    .catch(function () {
      res.render("404");
    });
};

exports.profileFollowing = async function (req, res) {
  Follow.findFollowingByUserId(req.profileUser._id)
    .then(function (following) {
      res.render("profile-following", {
        eventCount: req.eventCount,
        joinedEventCount: req.joinedEventCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount,
        friendCount: req.friendCount,
        currentPage: "following",
        isFollowing: req.isFollowing,
        areFriends: req.areFriends || false,
        following: following,
        profileUsername: req.profileUser.username,
        profileUserId: req.profileUser._id.toString(),
      });
    })
    .catch(function () {
      res.render("404");
    });
};
