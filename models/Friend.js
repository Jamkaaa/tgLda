const usersCollection = require("../db").collection("users");
const friendsCollection = require("../db").collection("friends");
const ObjectID = require("mongodb").ObjectId;
const User = require("./User");

let Friend = function (data, requesterId) {
  this.data = data;
  this.requesterId = requesterId;
  this.errors = [];
};

// Send friend request
Friend.sendRequest = function (fromUserId, toUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("📨 Friend.sendRequest - fromUserId:", fromUserId, typeof fromUserId);
      console.log("📨 Friend.sendRequest - toUserId:", toUserId, typeof toUserId);
      
      // Convert to ObjectID if needed
      let fromId = typeof fromUserId === "string" ? new ObjectID(fromUserId) : fromUserId;
      let toId = typeof toUserId === "string" ? new ObjectID(toUserId) : toUserId;

      console.log("📨 Friend.sendRequest - fromId converted:", fromId);
      console.log("📨 Friend.sendRequest - toId converted:", toId);

      // Check if request already exists
      let existingRequest = await friendsCollection.findOne({
        $or: [
          { requester: fromId, recipient: toId },
          { requester: toId, recipient: fromId }
        ]
      });

      console.log("📨 Friend.sendRequest - existingRequest:", existingRequest);

      if (existingRequest) {
        if (existingRequest.status === "accepted") {
          reject("Та аль хэдийн найз байна.");
        } else if (existingRequest.status === "pending") {
          reject("Найзын хүсэлт илгээсэн байна.");
        }
        return;
      }

      // Create friend request
      let result = await friendsCollection.insertOne({
        requester: fromId,
        recipient: toId,
        status: "pending",
        createdDate: new Date()
      });

      console.log("✅ Friend request created:", result.insertedId);

      resolve({ success: true });
    } catch (error) {
      console.log("❌ Friend.sendRequest error:", error);
      reject("Найзын хүсэлт илгээхэд алдаа гарлаа.");
    }
  });
};

// Accept friend request
Friend.acceptRequest = function (requestId, userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;
      let reqObjectId = typeof requestId === "string" ? new ObjectID(requestId) : requestId;

      let result = await friendsCollection.updateOne(
        { _id: reqObjectId, recipient: userObjectId, status: "pending" },
        { $set: { status: "accepted", acceptedDate: new Date() } }
      );

      if (result.modifiedCount === 0) {
        reject("Найзын хүсэлт олдсонгүй.");
        return;
      }

      resolve({ success: true });
    } catch (error) {
      reject("Найзын хүсэлтийг хүлээн авахад алдаа гарлаа.");
    }
  });
};

// Reject/Delete friend request
Friend.rejectRequest = function (requestId, userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;
      let reqObjectId = typeof requestId === "string" ? new ObjectID(requestId) : requestId;

      let result = await friendsCollection.deleteOne({
        _id: reqObjectId,
        recipient: userObjectId,
        status: "pending"
      });

      if (result.deletedCount === 0) {
        reject("Найзын хүсэлт олдсонгүй.");
        return;
      }

      resolve({ success: true });
    } catch (error) {
      reject("Найзын хүсэлтийг татгалзахад алдаа гарлаа.");
    }
  });
};

// Remove friend
Friend.removeFriend = function (userId, friendId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;
      let friendObjectId = typeof friendId === "string" ? new ObjectID(friendId) : friendId;

      let result = await friendsCollection.deleteOne({
        $or: [
          { requester: userObjectId, recipient: friendObjectId, status: "accepted" },
          { requester: friendObjectId, recipient: userObjectId, status: "accepted" }
        ]
      });

      if (result.deletedCount === 0) {
        reject("Найз олдсонгүй.");
        return;
      }

      resolve({ success: true });
    } catch (error) {
      reject("Найзыг устгахад алдаа гарлаа.");
    }
  });
};

// Check if two users are friends
Friend.areFriends = function (userId1, userId2) {
  return new Promise(async (resolve, reject) => {
    try {
      let user1Id = typeof userId1 === "string" ? new ObjectID(userId1) : userId1;
      let user2Id = typeof userId2 === "string" ? new ObjectID(userId2) : userId2;

      let friendship = await friendsCollection.findOne({
        $or: [
          { requester: user1Id, recipient: user2Id, status: "accepted" },
          { requester: user2Id, recipient: user1Id, status: "accepted" }
        ]
      });

      resolve(!!friendship);
    } catch (error) {
      resolve(false);
    }
  });
};

// Get all friends of a user
Friend.getFriendsList = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;

      let friendships = await friendsCollection
        .aggregate([
          {
            $match: {
              $or: [
                { requester: userObjectId, status: "accepted" },
                { recipient: userObjectId, status: "accepted" }
              ]
            }
          },
          {
            $project: {
              friendId: {
                $cond: [
                  { $eq: ["$requester", userObjectId] },
                  "$recipient",
                  "$requester"
                ]
              },
              acceptedDate: 1
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "friendId",
              foreignField: "_id",
              as: "friendData"
            }
          },
          {
            $unwind: "$friendData"
          },
          {
            $sort: { acceptedDate: -1 }
          }
        ])
        .toArray();

      let friends = friendships.map((item) => {
        return {
          _id: item.friendData._id,
          username: item.friendData.username,
          email: item.friendData.email,
          avatar: new User(item.friendData, true).avatar,
          acceptedDate: item.acceptedDate
        };
      });

      resolve(friends);
    } catch (error) {
      reject(error);
    }
  });
};

// Get pending friend requests (received)
Friend.getPendingRequests = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;

      let requests = await friendsCollection
        .aggregate([
          {
            $match: {
              recipient: userObjectId,
              status: "pending"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "requester",
              foreignField: "_id",
              as: "requesterData"
            }
          },
          {
            $unwind: "$requesterData"
          },
          {
            $sort: { createdDate: -1 }
          }
        ])
        .toArray();

      let pendingRequests = requests.map((item) => {
        return {
          requestId: item._id,
          user: {
            _id: item.requesterData._id,
            username: item.requesterData.username,
            email: item.requesterData.email,
            avatar: new User(item.requesterData, true).avatar
          },
          createdDate: item.createdDate
        };
      });

      resolve(pendingRequests);
    } catch (error) {
      reject(error);
    }
  });
};

// Get sent friend requests
Friend.getSentRequests = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;

      let requests = await friendsCollection
        .aggregate([
          {
            $match: {
              requester: userObjectId,
              status: "pending"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "recipient",
              foreignField: "_id",
              as: "recipientData"
            }
          },
          {
            $unwind: "$recipientData"
          },
          {
            $sort: { createdDate: -1 }
          }
        ])
        .toArray();

      let sentRequests = requests.map((item) => {
        return {
          requestId: item._id,
          user: {
            _id: item.recipientData._id,
            username: item.recipientData.username,
            email: item.recipientData.email,
            avatar: new User(item.recipientData, true).avatar
          },
          createdDate: item.createdDate
        };
      });

      resolve(sentRequests);
    } catch (error) {
      reject(error);
    }
  });
};

// Count friends
Friend.countFriends = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;

      let count = await friendsCollection.countDocuments({
        $or: [
          { requester: userObjectId, status: "accepted" },
          { recipient: userObjectId, status: "accepted" }
        ]
      });

      resolve(count);
    } catch (error) {
      resolve(0);
    }
  });
};

// Count pending friend requests (received)
Friend.countPendingRequests = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === "string" ? new ObjectID(userId) : userId;

      let count = await friendsCollection.countDocuments({
        recipient: userObjectId,
        status: "pending"
      });

      resolve(count);
    } catch (error) {
      resolve(0);
    }
  });
};

module.exports = Friend;
