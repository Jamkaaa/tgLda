const eventsCollection = require("../db").collection("events");
const ObjectID = require("mongodb").ObjectId;
const User = require("./User");
const sanitizeHTML = require("sanitize-html");

let Event = function (data, userId, requestedEventId) {
  this.data = data;
  this.errors = [];
  this.userId = userId;
  this.requestedEventId = requestedEventId;
};

Event.prototype.cleanUp = function () {
  if (typeof this.data.name != "string") {
    this.data.name = "";
  }
  if (typeof this.data.location != "string") {
    this.data.location = "";
  }
  if (typeof this.data.description != "string") {
    this.data.description = "";
  }
  if (typeof this.data.capacity != "string") {
    this.data.capacity = "";
  }
  if (typeof this.data.eventDate != "string") {
    this.data.eventDate = "";
  }

  // get rid of any bogus properties
  this.data = {
    name: sanitizeHTML(this.data.name.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    location: sanitizeHTML(this.data.location.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    description: sanitizeHTML(this.data.description.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    capacity: parseInt(this.data.capacity),
    eventDate: this.data.eventDate,
    createdDate: new Date(),
    author: new ObjectID(this.userId),
    participants: [],
  };
};

Event.prototype.validate = function () {
  if (this.data.name == "") {
    this.errors.push("Үйл явдлын нэр оруулах шаардлагатай.");
  }
  if (this.data.location == "") {
    this.errors.push("Үйл явдал болох газар оруулах шаардлагатай.");
  }
  if (this.data.description == "") {
    this.errors.push("Үйл явдлын тайлбар оруулах шаардлагатай.");
  }
  if (!this.data.capacity || this.data.capacity < 1) {
    this.errors.push("Хүмүүсийн тоо 1-ээс их байх ёстой.");
  }
  if (this.data.eventDate == "") {
    this.errors.push("Үйл явдлын огноо, цаг оруулах шаардлагатай.");
  }
};

Event.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      // save event into database
      eventsCollection
        .insertOne(this.data)
        .then((info) => {
          resolve(info.insertedId);
        })
        .catch(() => {
          this.errors.push("Алдаа гарлаа. Дахин оролдоно уу.");
          reject(this.errors);
        });
    } else {
      reject(this.errors);
    }
  });
};

Event.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    try {
      let event = await Event.findSingleById(this.requestedEventId, this.userId);
      if (event.isVisitorOwner) {
        // actually update the db
        let status = await this.actuallyUpdate();
        resolve(status);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Event.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      await eventsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedEventId) },
        {
          $set: {
            name: this.data.name,
            location: this.data.location,
            description: this.data.description,
            capacity: this.data.capacity,
            eventDate: this.data.eventDate,
          },
        }
      );
      resolve("success");
    } else {
      resolve("failure");
    }
  });
};

Event.reusableEventQuery = function (uniqueOperations, visitorId) {
  return new Promise(async function (resolve, reject) {
    let aggOperations = uniqueOperations.concat([
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
          name: 1,
          location: 1,
          description: 1,
          capacity: 1,
          eventDate: 1,
          createdDate: 1,
          participants: 1,
          authorId: "$author",
          author: { $arrayElemAt: ["$authorDocument", 0] },
        },
      },
    ]);

    let events = await eventsCollection.aggregate(aggOperations).toArray();

    // clean up author property in each event object
    events = events.map(function (event) {
      // Convert visitorId to ObjectID if needed for comparisons
      let visitorObjectId = null;
      if (visitorId) {
        visitorObjectId = typeof visitorId === 'string' ? new ObjectID(visitorId) : visitorId;
      }

      event.isVisitorOwner = visitorObjectId ? event.authorId.equals(visitorObjectId) : false;
      event.authorId = undefined;

      // Check if author exists (in case user was deleted)
      if (event.author && event.author.username) {
        event.author = {
          username: event.author.username,
          avatar: new User(event.author, true).avatar,
        };
      } else {
        event.author = {
          username: "Unknown",
          avatar: "https://gravatar.com/avatar/placeholder?s=128",
        };
      }

      // Calculate available spots
      event.availableSpots = event.capacity - event.participants.length;
      event.isFull = event.participants.length >= event.capacity;

      // Check if visitor has joined
      event.hasJoined = false;
      if (visitorObjectId) {
        event.hasJoined = event.participants.some((p) =>
          p.equals(visitorObjectId)
        );
      }

      return event;
    });

    resolve(events);
  });
};

Event.findSingleById = function (id, visitorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof id != "string" || !ObjectID.isValid(id)) {
      reject();
      return;
    }

    let events = await Event.reusableEventQuery(
      [{ $match: { _id: new ObjectID(id) } }],
      visitorId
    );

    if (events.length) {
      resolve(events[0]);
    } else {
      reject();
    }
  });
};

Event.findByAuthorId = function (authorId) {
  return Event.reusableEventQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } },
  ]);
};

Event.getAllEvents = function (visitorId) {
  return new Promise(async function (resolve, reject) {
    let events = await Event.reusableEventQuery(
      [{ $sort: { createdDate: -1 } }],
      visitorId
    );
    resolve(events);
  });
};

Event.delete = function (eventIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let event = await Event.findSingleById(eventIdToDelete, currentUserId);
      if (event.isVisitorOwner) {
        await eventsCollection.deleteOne({ _id: new ObjectID(eventIdToDelete) });
        resolve();
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Event.joinEvent = function (eventId, userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let event = await Event.findSingleById(eventId, userId);
      
      console.log("🔍 Join Debug:");
      console.log("userId:", userId);
      console.log("userId type:", typeof userId);
      console.log("participants:", event.participants);
      console.log("hasJoined:", event.hasJoined);

      // Check if event is full
      if (event.isFull) {
        reject("Үйл явдал дүүрсэн байна.");
        return;
      }

      // Check if already joined
      if (event.hasJoined) {
        reject("Та аль хэдийн нэгдсэн байна.");
        return;
      }

      // Add user to participants (addToSet prevents duplicates)
      await eventsCollection.updateOne(
        { _id: new ObjectID(eventId) },
        { $addToSet: { participants: new ObjectID(userId) } }
      );

      // Check if event is now full
      let updatedEvent = await Event.findSingleById(eventId, userId);
      
      resolve({
        success: true,
        isFull: updatedEvent.isFull,
        participants: updatedEvent.participants,
      });
    } catch (error) {
      reject(error);
    }
  });
};

Event.leaveEvent = function (eventId, userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let event = await Event.findSingleById(eventId, userId);

      // Check if user has joined
      if (!event.hasJoined) {
        reject("Та энэ үйл явдалд нэгдээгүй байна.");
        return;
      }

      // Remove user from participants
      await eventsCollection.updateOne(
        { _id: new ObjectID(eventId) },
        { $pull: { participants: new ObjectID(userId) } }
      );

      resolve({ success: true });
    } catch (error) {
      reject(error);
    }
  });
};

Event.getParticipants = function (eventId) {
  return new Promise(async (resolve, reject) => {
    try {
      let event = await eventsCollection
        .aggregate([
          { $match: { _id: new ObjectID(eventId) } },
          {
            $lookup: {
              from: "users",
              localField: "participants",
              foreignField: "_id",
              as: "participantDetails",
            },
          },
        ])
        .toArray();

      if (event.length) {
        let participants = event[0].participantDetails.map((user) => {
          return {
            username: user.username,
            email: user.email,
            avatar: new User(user, true).avatar,
          };
        });
        resolve(participants);
      } else {
        reject();
      }
    } catch (error) {
      reject(error);
    }
  });
};

Event.findJoinedEventsByUserId = function (userId) {
  return new Promise(async (resolve, reject) => {
    try {
      let userObjectId = typeof userId === 'string' ? new ObjectID(userId) : userId;
      
      let events = await eventsCollection
        .aggregate([
          { $match: { participants: userObjectId } },
          { $sort: { eventDate: -1 } },
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
              name: 1,
              location: 1,
              description: 1,
              capacity: 1,
              eventDate: 1,
              createdDate: 1,
              participants: 1,
              author: { $arrayElemAt: ["$authorDocument", 0] },
            },
          },
        ])
        .toArray();

      events = events.map(function (event) {
        // Check if author exists (in case user was deleted)
        if (event.author && event.author.username) {
          event.author = {
            username: event.author.username,
            avatar: new User(event.author, true).avatar,
          };
        } else {
          event.author = {
            username: "Unknown",
            avatar: "https://gravatar.com/avatar/placeholder?s=128",
          };
        }
        event.availableSpots = event.capacity - event.participants.length;
        event.isFull = event.participants.length >= event.capacity;
        return event;
      });

      resolve(events);
    } catch (error) {
      reject(error);
    }
  });
};

// Get full events created by user
Event.getFullEventsByAuthor = function (authorId) {
  return new Promise(async (resolve, reject) => {
    try {
      let authorObjectId = typeof authorId === "string" ? new ObjectID(authorId) : authorId;

      let events = await eventsCollection
        .aggregate([
          {
            $match: {
              author: authorObjectId
            }
          },
          {
            $addFields: {
              participantCount: { $size: "$participants" },
              isFull: { $gte: [{ $size: "$participants" }, "$capacity"] }
            }
          },
          {
            $match: {
              isFull: true
            }
          },
          {
            $sort: { createdDate: -1 }
          }
        ])
        .toArray();

      resolve(events);
    } catch (error) {
      resolve([]);
    }
  });
};

// Count full events created by user
Event.countFullEventsByAuthor = function (authorId) {
  return new Promise(async (resolve, reject) => {
    try {
      let authorObjectId = typeof authorId === "string" ? new ObjectID(authorId) : authorId;

      let count = await eventsCollection.countDocuments({
        author: authorObjectId,
        $expr: { $gte: [{ $size: "$participants" }, "$capacity"] }
      });

      resolve(count);
    } catch (error) {
      resolve(0);
    }
  });
};

module.exports = Event;
