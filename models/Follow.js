const { ObjectId } = require("mongodb");

const followsCollection = require("../db").collection("follows");
const usersCollection = require("../db").collection("users");

let Follow = function (followUsername, authorId) {
  this.followUsername = followUsername;
  this.authorId = authorId;
  this.errors = [];
};

Follow.prototype.validate = async function () {
  if (
    typeof this.followUsername !== "string" ||
    this.followUsername.trim() === ""
  ) {
    this.errors.push("Invalid follow username");
  }
  if (typeof this.authorId !== "string" || this.authorId.trim() === "") {
    this.errors.push("Invalid author ID");
  }

  let followedAccount = await usersCollection.findOne({
    username: this.followUsername,
  });

  if (followedAccount) {
    this.followedId = followedAccount._id;
  } else {
    this.errors.push("Та дагах гэж буй хэрэглэгч байхгүй байна");
  }
};

Follow.prototype.create = function () {
  return new Promise(async (resolve, reject) => {
    await this.validate();
    if (this.errors.length) {
      reject(this.errors);
    } else {
      followsCollection
        .insertOne({
          followedId: this.followedId,
          authorId: new ObjectId(this.authorId),
        })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    }
  });
};

Follow.prototype.delete = function () {
  return new Promise(async (resolve, reject) => {
    await this.validate();
    if (this.errors.length) {
      reject(this.errors);
    } else {
      followsCollection
        .deleteOne({
          followedId: this.followedId,
          authorId: new ObjectId(this.authorId),
        })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    }
  });
};

Follow.isUserFollowing = async function (followId, userId) {
  let doc = await followsCollection.findOne({
    followedId: followId,
    authorId: new ObjectId(userId),
  });
  if (doc) {
    return true;
  } else {
    return false;
  }
};

Follow.findFollowersByUserId = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollection
        .aggregate([
          { $match: { followedId: userId } },
          {
            $lookup: {
              from: "users",
              localField: "authorId",
              foreignField: "_id",
              as: "followerDoc",
            },
          },
          {
            $project: {
              username: "$followerDoc.username",
              email: "$followerDoc.email",
            },
          },
        ])
        .toArray();
      resolve(followers);
    } catch (err) {
      reject(err);
    }
  });
};

Follow.findFollowingByUserId = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let following = await followsCollection
        .aggregate([
          { $match: { authorId: userId } },
          {
            $lookup: {
              from: "users",
              localField: "followedId",
              foreignField: "_id",
              as: "followingDoc",
            },
          },
          {
            $project: {
              username: "$followingDoc.username",
              email: "$followingDoc.email",
            },
          },
        ])
        .toArray();
      resolve(following);
    } catch (err) {
      reject(err);
    }
  });
};

Follow.countFollowersByUserId = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let followerCount = await followsCollection.countDocuments({
        followedId: userId,
      });
      resolve(followerCount);
    } catch {
      resolve(0);
    }
  });
};

Follow.countFollowingByUserId = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let followingCount = await followsCollection.countDocuments({
        authorId: userId,
      });
      resolve(followingCount);
    } catch {
      resolve(0);
    }
  });
};

module.exports = Follow;
