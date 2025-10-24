const Friend = require("../models/Friend");
const Event = require("../models/Event");

// Get all notifications for user
exports.getNotifications = async function (req, res) {
  try {
    // Get pending friend requests
    let friendRequests = await Friend.getPendingRequests(req.session.user._id);
    
    // Get events created by user that are now full
    let fullEvents = await Event.getFullEventsByAuthor(req.session.user._id);
    
    // Combine notifications
    let notifications = [];
    
    // Add friend request notifications
    friendRequests.forEach(request => {
      notifications.push({
        type: 'friend_request',
        message: `${request.requesterUsername} таньд найзын хүсэлт илгээсэн байна`,
        username: request.requesterUsername,
        requestId: request._id,
        createdDate: request.createdDate
      });
    });
    
    // Add full event notifications
    fullEvents.forEach(event => {
      notifications.push({
        type: 'event_full',
        message: `"${event.name}" арга хэмжээ дүүрсэн байна`,
        eventId: event._id,
        eventName: event.name,
        createdDate: event.createdDate
      });
    });
    
    // Sort by date (newest first)
    notifications.sort((a, b) => b.createdDate - a.createdDate);
    
    res.json({
      success: true,
      notifications: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.log("❌ Get notifications error:", error);
    res.json({
      success: false,
      notifications: [],
      count: 0
    });
  }
};

// Get notification count
exports.getNotificationCount = async function (req, res, next) {
  try {
    let friendRequestCount = await Friend.countPendingRequests(req.session.user._id);
    let fullEventCount = await Event.countFullEventsByAuthor(req.session.user._id);
    
    req.notificationCount = friendRequestCount + fullEventCount;
    next();
  } catch (error) {
    req.notificationCount = 0;
    next();
  }
};
