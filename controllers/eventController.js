const Event = require("../models/Event");

exports.viewCreateEvent = function (req, res) {
  res.render("create-event", { title: "Create Event" });
};

exports.createEvent = function (req, res) {
  let event = new Event(req.body, req.session.user._id);
  event
    .create()
    .then(function (newId) {
      req.flash("success", "New event created successfully!");
      req.session.save(() => res.redirect(`/event/${newId}`));
    })
    .catch(function (errors) {
      if (Array.isArray(errors)) {
        errors.forEach((error) => req.flash("errors", error));
      } else {
        req.flash("errors", "Алдаа гарлаа. Дахин оролдоно уу.");
      }
      req.session.save(() => res.redirect("/create-event"));
    });
};

exports.viewSingleEvent = async function (req, res) {
  try {
    let visitorId = req.session.user ? req.session.user._id : null;
    let event = await Event.findSingleById(req.params.id, visitorId);
    let participants = await Event.getParticipants(req.params.id);
    res.render("single-event", { 
      event: event, 
      participants: participants,
      title: event.name 
    });
  } catch {
    res.render("404");
  }
};

exports.viewEditEvent = async function (req, res) {
  try {
    let event = await Event.findSingleById(req.params.id, req.session.user._id);
    if (event.isVisitorOwner) {
      res.render("edit-event", { event: event, title: "Edit Event" });
    } else {
      req.flash("errors", "Таньд энэ үйл явдлыг засах эрх байхгүй.");
      req.session.save(() => res.redirect("/"));
    }
  } catch {
    res.render("404");
  }
};

exports.edit = function (req, res) {
  let event = new Event(req.body, req.session.user._id, req.params.id);
  event
    .update()
    .then((status) => {
      if (status == "success") {
        req.flash("success", "event successfully updated.");
        req.session.save(function () {
          res.redirect(`/event/${req.params.id}`);
        });
      } else {
        if (Array.isArray(event.errors)) {
          event.errors.forEach(function (error) {
            req.flash("errors", error);
          });
        } else {
          req.flash("errors", "Алдаа гарлаа. Дахин оролдоно уу.");
        }
        req.session.save(function () {
          res.redirect(`/event/${req.params.id}/edit`);
        });
      }
    })
    .catch(() => {
      req.flash("errors", "Таньд энэ үйл явдлыг засах эрх байхгүй.");
      req.session.save(function () {
        res.redirect("/");
      });
    });
};

exports.delete = function (req, res) {
  Event.delete(req.params.id, req.session.user._id)
    .then(() => {
      req.flash("success", "event successfully deleted.");
      req.session.save(() =>
        res.redirect(`/profile/${req.session.user.username}`)
      );
    })
    .catch(() => {
      req.flash("errors", "Таньд энэ үйл явдлыг устгах эрх байхгүй.");
      req.session.save(() => res.redirect("/"));
    });
};

exports.viewAllEvents = async function (req, res) {
  try {
    let visitorId = req.session.user ? req.session.user._id : null;
    let events = await Event.getAllEvents(visitorId);
    res.render("all-events", { events: events, title: "All Events" });
  } catch {
    res.render("404");
  }
};

exports.joinEvent = function (req, res) {
  // Check if user is logged in
  if (!req.session.user || !req.session.user._id) {
    req.flash("errors", "Нэвтэрч орсон байх ёстой.");
    return req.session.save(() => res.redirect("/"));
  }

  console.log("🔍 Join Controller - userId:", req.session.user._id);
  console.log("🔍 Join Controller - userId type:", typeof req.session.user._id);

  Event.joinEvent(req.params.id, req.session.user._id)
    .then((result) => {
      req.flash("success", "You have successfully joined the event!");
      
      // Send socket notification if event is full
      if (result.isFull) {
        // Get socket instance and emit to all participants
        const io = req.app.get("io");
        result.participants.forEach((participantId) => {
          io.emit("eventFull", {
            eventId: req.params.id,
            message: "event is full! Get ready!",
          });
        });
      }
      
      req.session.save(() => res.redirect(`/event/${req.params.id}`));
    })
    .catch((error) => {
      req.flash("errors", error);
      req.session.save(() => res.redirect(`/event/${req.params.id}`));
    });
};

exports.leaveEvent = function (req, res) {
  Event.leaveEvent(req.params.id, req.session.user._id)
    .then(() => {
      req.flash("success", "Та үйл явдлаас амжилттай гарлаа.");
      req.session.save(() => res.redirect(`/event/${req.params.id}`));
    })
    .catch((error) => {
      req.flash("errors", error);
      req.session.save(() => res.redirect(`/event/${req.params.id}`));
    });
};
