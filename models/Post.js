const { ObjectId } = require("mongodb");
const sanitizeHTML = require("sanitize-html");

const followsCollection = require("../db").collection("follows");
const postsCollection = require("../db").collection("posts");
let Post = function (data, userid) {
  this.data = data;
  this.errors = [];
  this.userid = userid;
};

Post.findSinglePostById = async function (id) {
  return new Promise(async (resolve, reject) => {
    let posts = await Post.getPostWithAuthorQuery([
      { $match: { _id: new ObjectId(id) } },
    ]);

    if (posts.length) {
      resolve(posts[0]);
    } else {
      reject("Post not found");
    }
  });
};

Post.getPostWithAuthorQuery = function (operations, sortOperations = []) {
  return new Promise(async (resolve, reject) => {
    let aggOperations = operations
      .concat([
        {
          $lookup: {
            from: "users",
            localField: "author",
            foreignField: "_id",
            as: "authorDocument",
          },
        },
        {
          $project: {
            title: 1,
            body: 1,
            createDate: 1,
            author: { $arrayElemAt: ["$authorDocument", 0] },
          },
        },
      ])
      .concat(sortOperations);

    let posts = await postsCollection.aggregate(aggOperations).toArray();
    if (posts.length) {
      resolve(posts);
    } else {
      resolve([]);
    }
  });
};

Post.findPostsByAuthorId = async function (authorId) {
  return Post.getPostWithAuthorQuery([
    { $match: { author: new ObjectId(authorId) } },
    { $sort: { createDate: -1 } },
  ]);
};

Post.prototype.validate = function () {
  console.log("🚀 ~ this.userid:", this.userid);
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    author: new ObjectId(this.userid),
    createDate: new Date(),
  };

  if (this.data.title == "" || this.data.title.length < 2) {
    this.errors.push("Та гарчиг оруулна уу");
  }
  if (this.data.body == "" || this.data.body.length < 2) {
    this.errors.push("Та бичлэгийн агуулгаа оруулна уу");
  }
};

Post.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.validate();
    if (this.errors.length) {
      reject(this.errors);
    } else {
      postsCollection
        .insertOne(this.data)
        .then((info) => {
          resolve(info.insertedId);
        })
        .catch(() => {
          this.errors.push("Алдаа гарлаа. Дахин оролдоно уу");
          reject(this.errors);
        });
    }
  });
};

Post.prototype.update = function (id) {
  return new Promise((resolve, reject) => {
    this.validate();
    if (this.errors.length) {
      reject(this.errors);
    } else {
      postsCollection
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { title: this.data.title, body: this.data.body } }
        )
        .then(() => {
          resolve("success");
        })
        .catch((err) => {
          this.errors.push("Алдаа гарлаа. Дахин оролдоно уу: " + err);
          reject(this.errors);
        });
    }
  });
};

Post.delete = function (postId, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSinglePostById(postId);
      if (post.author._id.toString() === new Object(currentUserId).toString()) {
        await postsCollection.deleteOne({ _id: new ObjectId(postId) });
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
};

Post.search = function (searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof searchTerm == "string") {
      try {
        let posts = await Post.getPostWithAuthorQuery(
          [
            {
              $match: {
                $text: { $search: searchTerm },
              },
            },
          ],
          [{ $sort: { score: { $meta: "textScore" } } }]
        );
        resolve(posts);
      } catch (err1) {
        console.log("err1" + err1);
        resolve([]);
      }
    } else {
      reject("Invalid search term");
    }
  });
};

Post.countPostsByAuthorId = function (authorId) {
  return new Promise(async (resolve, reject) => {
    try {
      let postCount = await postsCollection.countDocuments({
        author: authorId,
      });
      resolve(postCount);
    } catch (err) {
      resolve(0);
    }
  });
};

Post.getFeed = async function (userid) {
  let followedUsers = await followsCollection
    .find({ authorId: new ObjectId(userid) })
    .toArray();
  console.log("🚀 ~ followedUsers:", followedUsers);

  followedUsers = followedUsers.map(function (followDoc) {
    return followDoc.followedId;
  });
  console.log("🚀 ~ followedUsers:", followedUsers);

  // тэгээд тэр id уудын бүх постуудыг харуулна
  return Post.getPostWithAuthorQuery([
    { $match: { author: { $in: followedUsers } } },
    { $sort: { createDate: -1 } },
  ]);
};

module.exports = Post;
