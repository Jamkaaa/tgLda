const Friend = require("../models/Friend");

// Get recent chat contacts (friends)
exports.getRecentChats = async function (req, res) {
  try {
    // Get all friends
    let friends = await Friend.getFriendsList(req.session.user._id);
    
    // Get connected users from app
    const connectedUsers = req.app.get("connectedUsers") || new Map();
    
    // Add online status to each friend
    const friendsWithStatus = friends.map(f => ({
      username: f.username,
      userId: f._id.toString(),
      avatar: f.avatar,
      isOnline: connectedUsers.has(f.username) // Check if user is connected
    }));
    
    res.json({
      success: true,
      friends: friendsWithStatus
    });
  } catch (error) {
    console.log("❌ Get recent chats error:", error);
    res.json({
      success: false,
      friends: []
    });
  }
};
