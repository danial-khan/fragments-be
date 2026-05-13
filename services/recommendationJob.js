const cron = require('node-cron');
const UserModel = require('../database/models/user');
const EventModel = require('../database/models/event');
const UserFragmentModel = require('../database/models/userFragment');
const fragmentRecommendationEngine = require('../utils/fragmentRecommendation');

class RecommendationJobService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
  }

  init() {
    cron.schedule("0 */6 * * *", () => {
      this.runRecommendationJob();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log('Recommendation job scheduler initialized');
  }

  async runRecommendationJob() {
    if (this.isRunning) {
      console.log('Recommendation job already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('Starting recommendation job');

      const activeUsers = await this.getActiveUsers();
      console.log(`Active users for recommendations: ${activeUsers.length}`);

      let processedCount = 0;
      let errorCount = 0;

      const batchSize = 10;
      for (let i = 0; i < activeUsers.length; i += batchSize) {
        const batch = activeUsers.slice(i, i + batchSize);

        const settled = await Promise.allSettled(
          batch.map((userId) => this.processUserRecommendations(userId))
        );

        settled.forEach((result) => {
          if (result.status === "rejected") {
            errorCount += 1;
            return;
          }
          if (result.value && result.value.success === false) {
            errorCount += 1;
          }
        });

        processedCount += batch.length;
        console.log(`Recommendation batch progress: ${processedCount}/${activeUsers.length} users`);

        // Add small delay between batches to prevent overwhelming the system
        if (i + batchSize < activeUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.lastRun = new Date();
      console.log(
        `Recommendation job completed in ${Date.now() - startTime}ms (errors: ${errorCount})`
      );

    } catch (error) {
      console.error('Recommendation job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Get active users (users with recent events)
  async getActiveUsers() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUserIds = await EventModel.distinct("payload.userId", {
      timestamp: { $gte: thirtyDaysAgo },
      "payload.userId": { $exists: true, $ne: null },
    });

    return activeUserIds.filter(Boolean);
  }

  async processUserRecommendations(userId) {
    try {
      const recommendations = await fragmentRecommendationEngine.generateRecommendations(userId, 50);
      
      if (recommendations.length > 0) {
        await fragmentRecommendationEngine.saveRecommendations(userId, recommendations);
        
        console.log(`Generated ${recommendations.length} recommendations for user ${userId}`);
      }

      return { success: true, count: recommendations.length };
    } catch (error) {
      console.error(`Error processing recommendations for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async triggerRecommendationJob() {
    console.log('Manually triggering recommendation job');
    await this.runRecommendationJob();
  }

  getJobStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.getNextScheduledRun()
    };
  }

  getNextScheduledRun() {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Find next 6-hour interval
    const currentHour = now.getHours();
    const nextHour = Math.ceil(currentHour / 6) * 6;
    
    if (nextHour >= 24) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
    } else {
      nextRun.setHours(nextHour, 0, 0, 0);
    }
    
    return nextRun;
  }

  // Clean up old recommendations (older than 30 days)
  async cleanupOldRecommendations() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await UserFragmentModel.deleteMany({
        lastRecommended: { $lt: thirtyDaysAgo },
        isViewed: false,
        isClicked: false
      });

      console.log(`Cleaned up ${result.deletedCount} old recommendation records`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old recommendations:', error);
      return 0;
    }
  }

  // Update recommendation when user interacts with a fragment
  async updateUserInteraction(userId, fragmentId, interactionType) {
    try {
      const update = {};
      
      if (interactionType === 'view') {
        update.isViewed = true;
      } else if (interactionType === 'click') {
        update.isClicked = true;
        update.isViewed = true;
      }

      await UserFragmentModel.updateOne(
        { userId, fragmentId },
        { $set: update }
      );
    } catch (error) {
      console.error('Error updating user interaction:', error);
    }
  }

  // Get recommendations for a specific user (for API endpoint)
  async getUserRecommendations(userId, limit = 20, forceRefresh = false) {
    try {
      if (forceRefresh) {
        // Generate fresh recommendations
        const recommendations = await fragmentRecommendationEngine.generateRecommendations(userId, limit);
        await fragmentRecommendationEngine.saveRecommendations(userId, recommendations);
        
        return recommendations.map(rec => ({
          ...rec.fragment,
          recommendationScore: rec.score,
          recommendationReason: rec.reason,
          aiExplanation: rec.metadata.aiExplanation
        }));
      } else {
        // Get stored recommendations
        const storedRecs = await fragmentRecommendationEngine.getStoredRecommendations(userId, limit);
        
        if (storedRecs.length === 0) {
          // No stored recommendations, generate fresh ones
          return await this.getUserRecommendations(userId, limit, true);
        }

        return storedRecs.map(rec => ({
          ...rec.fragmentId,
          recommendationScore: rec.score,
          recommendationReason: rec.reason,
          aiExplanation: rec.metadata.aiExplanation
        }));
      }
    } catch (error) {
      console.error('Error getting user recommendations:', error);
      return [];
    }
  }
}

module.exports = new RecommendationJobService(); 