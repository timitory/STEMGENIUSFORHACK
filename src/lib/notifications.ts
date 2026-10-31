import { supabase } from "@/integrations/supabase/client";

export interface NotificationData {
  user_id: string;
  type: "achievement" | "quiz" | "social" | "purchase" | "system" | "admin";
  title: string;
  message: string;
  data?: Record<string, any>;
  action_url?: string;
}

/**
 * Creates a notification for a user
 */
export const createNotification = async (notification: NotificationData) => {
  try {
    const { error } = await supabase.rpc("create_user_notification", {
      p_user_id: notification.user_id,
      p_type: notification.type,
      p_title: notification.title,
      p_message: notification.message,
      p_data: notification.data || {},
      p_action_url: notification.action_url || null,
    });

    if (error) {
      console.error("Error creating notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error creating notification:", error);
    return false;
  }
};

/**
 * Creates notifications for multiple users (useful for admin broadcasts)
 */
export const createBulkNotifications = async (
  userIds: string[],
  notification: Omit<NotificationData, "user_id">
) => {
  const promises = userIds.map(userId =>
    createNotification({ ...notification, user_id: userId })
  );

  const results = await Promise.all(promises);
  return results.filter(result => result).length;
};

/**
 * Creates a notification when a user completes a quiz
 */
export const notifyQuizCompletion = async (
  userId: string,
  score: number,
  totalQuestions: number,
  subject: string
) => {
  const percentage = Math.round((score / totalQuestions) * 100);

  let title = "Quiz Completed!";
  let message = `You scored ${score}/${totalQuestions} (${percentage}%) on your ${subject} quiz.`;

  // Special messages for high scores
  if (percentage >= 90) {
    title = "🏆 Outstanding Performance!";
    message = `Amazing! You scored ${percentage}% on your ${subject} quiz. You're a ${subject} expert!`;
  } else if (percentage >= 80) {
    title = "🎉 Great Job!";
    message = `Well done! You scored ${percentage}% on your ${subject} quiz. Keep it up!`;
  }

  return createNotification({
    user_id: userId,
    type: "quiz",
    title,
    message,
    data: { score, totalQuestions, subject, percentage },
    action_url: "/stem-challenge-arena",
  });
};

/**
 * Creates a notification when someone follows a user
 */
export const notifyNewFollower = async (
  followerId: string,
  followedUserId: string,
  followerName: string
) => {
  return createNotification({
    user_id: followedUserId,
    type: "social",
    title: "New Follower! 👥",
    message: `${followerName} started following you.`,
    data: { follower_id: followerId, follower_name: followerName },
    action_url: `/profile/${followerId}`,
  });
};

/**
 * Creates a notification when someone likes a user's profile
 */
export const notifyProfileLike = async (
  likerId: string,
  likedUserId: string,
  likerName: string
) => {
  return createNotification({
    user_id: likedUserId,
    type: "social",
    title: "Profile Liked! ❤️",
    message: `${likerName} liked your profile.`,
    data: { liker_id: likerId, liker_name: likerName },
    action_url: `/profile/${likerId}`,
  });
};

/**
 * Creates a notification for a successful purchase
 */
export const notifyPurchase = async (
  buyerId: string,
  itemTitle: string,
  itemType: string,
  price: number
) => {
  return createNotification({
    user_id: buyerId,
    type: "purchase",
    title: "Purchase Successful! 🛒",
    message: `Your order for "${itemTitle}" has been confirmed. Amount: $${price.toFixed(2)}`,
    data: { item_title: itemTitle, item_type: itemType, price },
    action_url: "/my-orders",
  });
};

/**
 * Creates a notification for seller when someone buys their product
 */
export const notifySellerNewOrder = async (
  sellerId: string,
  buyerName: string,
  itemTitle: string,
  price: number
) => {
  return createNotification({
    user_id: sellerId,
    type: "purchase",
    title: "New Order! 💰",
    message: `${buyerName} purchased your "${itemTitle}" for $${price.toFixed(2)}.`,
    data: { buyer_name: buyerName, item_title: itemTitle, price },
    action_url: "/marketplace-dashboard",
  });
};

/**
 * Creates achievement notifications
 */
export const notifyAchievement = async (
  userId: string,
  achievementType: string,
  achievementName: string,
  description: string
) => {
  return createNotification({
    user_id: userId,
    type: "achievement",
    title: `🏆 ${achievementName}`,
    message: description,
    data: { achievement_type: achievementType, achievement_name: achievementName },
    action_url: "/leaderboard",
  });
};

/**
 * Creates admin broadcast notifications
 */
export const notifyAdminBroadcast = async (
  userIds: string[],
  title: string,
  message: string,
  actionUrl?: string
) => {
  return createBulkNotifications(userIds, {
    type: "admin",
    title: `📢 ${title}`,
    message,
    data: { broadcast: true },
    action_url: actionUrl,
  });
};

/**
 * Creates notifications for quiz challenges
 */
export const notifyQuizChallenge = async (
  challengerId: string,
  challengedUserId: string,
  challengerName: string,
  subject: string
) => {
  return createNotification({
    user_id: challengedUserId,
    type: "quiz",
    title: "Quiz Challenge! ⚔️",
    message: `${challengerName} challenged you to a ${subject} quiz. Accept the challenge!`,
    data: { challenger_id: challengerId, challenger_name: challengerName, subject },
    action_url: "/stem-challenge-arena",
  });
};

/**
 * Creates notifications for reel comments
 */
export const notifyReelComment = async (
  commenterId: string,
  reelOwnerId: string,
  commenterName: string,
  reelTitle: string
) => {
  return createNotification({
    user_id: reelOwnerId,
    type: "social",
    title: "New Comment! 💬",
    message: `${commenterName} commented on your reel "${reelTitle}".`,
    data: { commenter_id: commenterId, commenter_name: commenterName, reel_title: reelTitle },
    action_url: "/stem-reels",
  });
};

/**
 * Creates notifications for reel likes
 */
export const notifyReelLike = async (
  likerId: string,
  reelOwnerId: string,
  likerName: string,
  reelTitle: string
) => {
  return createNotification({
    user_id: reelOwnerId,
    type: "social",
    title: "Reel Liked! 👍",
    message: `${likerName} liked your reel "${reelTitle}".`,
    data: { liker_id: likerId, liker_name: likerName, reel_title: reelTitle },
    action_url: "/stem-reels",
  });
};

/**
 * Checks and creates achievement notifications based on user progress
 */
export const checkAndNotifyAchievements = async (userId: string) => {
  try {
    // Get user's quiz statistics
    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select("score, total_points, correct_answers, total_questions")
      .eq("user_id", userId);

    if (error || !attempts) return;

    const totalQuizzes = attempts.length;
    const totalCorrect = attempts.reduce((sum, a) => sum + a.correct_answers, 0);
    const totalQuestions = attempts.reduce((sum, a) => sum + a.total_questions, 0);
    const perfectScores = attempts.filter(a => a.correct_answers === a.total_questions).length;
    const highScores = attempts.filter(a => (a.correct_answers / a.total_questions) >= 0.8).length;

    // Achievement checks
    const achievements = [];

    // First Quiz Achievement
    if (totalQuizzes === 1) {
      achievements.push({
        type: "first_quiz",
        name: "First Steps",
        description: "Completed your first quiz! Welcome to the STEM Genius community."
      });
    }

    // Quiz Master Achievement
    if (totalQuizzes >= 10) {
      achievements.push({
        type: "quiz_master",
        name: "Quiz Master",
        description: "Completed 10 quizzes! You're becoming a STEM expert."
      });
    }

    // Perfect Score Achievement
    if (perfectScores >= 1) {
      achievements.push({
        type: "perfect_score",
        name: "Perfectionist",
        description: "Scored 100% on a quiz! Outstanding performance."
      });
    }

    // High Achiever Achievement
    if (highScores >= 5) {
      achievements.push({
        type: "high_achiever",
        name: "High Achiever",
        description: "Scored 80% or higher on 5 quizzes! Keep up the excellent work."
      });
    }

    // Scholar Achievement
    if (totalCorrect >= 100) {
      achievements.push({
        type: "scholar",
        name: "STEM Scholar",
        description: "Answered 100 questions correctly! You're a true scholar."
      });
    }

    // Speed Demon Achievement (if we had time tracking)
    // This could be added later when time tracking is implemented

    // Create notifications for new achievements
    for (const achievement of achievements) {
      // Check if this achievement was already earned (we'd need an achievements table for this)
      // For now, we'll create the notification - duplicates will be handled by the UI
      await notifyAchievement(userId, achievement.type, achievement.name, achievement.description);
    }

  } catch (error) {
    console.error("Error checking achievements:", error);
  }
};