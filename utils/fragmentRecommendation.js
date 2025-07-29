const { config } = require("../config");
const OpenAI = require("openai");
const FragmentModel = require("../database/models/fragment");
const EventModel = require("../database/models/event");
const UserFragmentModel = require("../database/models/userFragment");

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

class FragmentRecommendationEngine {
  constructor() {
    this.openai = openai;
  }

  // Get user's recent activity patterns
  async getUserActivityPatterns(userId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const events = await EventModel.find({
      "payload.userId": userId.toString(),
      timestamp: { $gte: cutoffDate }
    }).sort({ timestamp: -1 });

    const patterns = {
      categories: {},
      titles: [],
      locations: {},
      devices: {},
      fragmentIds: [],
      totalEvents: events.length
    };

    events.forEach(event => {
      const payload = event.payload;
      
      // Track categories
      if (payload.categoryId) {
        patterns.categories[payload.categoryId] = (patterns.categories[payload.categoryId] || 0) + 1;
      }

      // Track fragment titles
      if (payload.fragmentTitle) {
        patterns.titles.push(payload.fragmentTitle);
      }

      // Track locations
      if (payload.location && payload.location.city) {
        patterns.locations[payload.location.city] = (patterns.locations[payload.location.city] || 0) + 1;
      }

      // Track devices
      if (payload.deviceInfo && payload.deviceInfo.device) {
        patterns.devices[payload.deviceInfo.device] = (patterns.devices[payload.deviceInfo.device] || 0) + 1;
      }

      // Track fragment IDs
      if (payload.fragmentId) {
        patterns.fragmentIds.push(payload.fragmentId);
      }
    });

    return patterns;
  }

  // Calculate category-based score
  async calculateCategoryScore(patterns) {
    const categoryScores = {};
    const totalCategoryEvents = Object.values(patterns.categories).reduce((sum, count) => sum + count, 0);

    for (const [categoryId, count] of Object.entries(patterns.categories)) {
      categoryScores[categoryId] = count / totalCategoryEvents;
    }

    return categoryScores;
  }

  // Calculate title similarity score using AI
  async calculateTitleSimilarityScore(userTitles, fragmentTitle) {
    if (!userTitles || userTitles.length === 0) return 0;

    try {
      const prompt = `
        Analyze the similarity between the user's recent fragment titles and a new fragment title.
        
        User's recent titles: ${userTitles.slice(0, 10).join(', ')}
        New fragment title: "${fragmentTitle}"
        
        Consider:
        1. Topic similarity
        2. Subject matter overlap
        3. Complexity level
        4. Interest area alignment
        
        Return only a number between 0 and 1, where:
        0 = No similarity
        1 = Perfect similarity
        
        Just return the number, nothing else.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 10
      });

      const score = parseFloat(response.choices[0].message.content.trim());
      return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
    } catch (error) {
      console.error("Error calculating title similarity:", error);
      return 0;
    }
  }

  // Calculate location-based score
  calculateLocationScore(userLocations) {
    if (!userLocations || Object.keys(userLocations).length === 0) return 0;

    // For now, return a simple score based on location match
    // In a real implementation, you might use geolocation APIs
    const userLocationKeys = Object.keys(userLocations);
    
    // If user has location data and fragment has location, give some score
    return userLocationKeys.length > 0 ? 0.3 : 0;
  }

  // Calculate device-based score
  calculateDeviceScore(userDevices) {
    if (!userDevices || Object.keys(userDevices).length === 0) return 0;
    
    const primaryDevice = Object.entries(userDevices).reduce((a, b) => 
      userDevices[a[0]] > userDevices[b[0]] ? a : b
    )[0];

    // Give higher score if fragment is optimized for user's primary device
    return primaryDevice === 'mobile' ? 0.2 : 0.1;
  }

  // Get AI-powered explanation for recommendation
  async getAIExplanation(userPatterns, fragment, score, reason) {
    try {
      const prompt = `
        Explain why this fragment is recommended to the user in a brief, engaging way.
        
        User's recent activity:
        - Categories: ${Object.keys(userPatterns.categories).join(', ')}
        - Recent titles: ${userPatterns.titles.slice(0, 5).join(', ')}
        - Primary device: ${Object.keys(userPatterns.devices).length > 0 ? Object.entries(userPatterns.devices).reduce((a, b) => userPatterns.devices[a[0]] > userPatterns.devices[b[0]] ? a : b)[0] : 'Unknown'}
        
        Fragment details:
        - Title: "${fragment.title}"
        - Description: "${fragment.description}"
        - Category: "${fragment.category?.name || 'Unknown'}"
        
        Recommendation reason: ${reason}
        Score: ${score}
        
        Provide a brief, personalized explanation (max 100 characters) that would appear to the user.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 50
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error getting AI explanation:", error);
      return "Recommended based on your interests";
    }
  }

  async generateRecommendations(userId, limit = null) {
    try {
      const patterns = await this.getUserActivityPatterns(userId);
      
      if (patterns.totalEvents === 0) {
        return await this.getPopularFragments(limit);
      }

      const allFragments = await FragmentModel.find({
        isDeleted: false,
        status: "published"
      })
      .populate("category", "name color")
      .populate("author", "name username")
      .lean();

      const scoredFragments = [];
      const categoryScores = await this.calculateCategoryScore(patterns);

      for (const fragment of allFragments) {
        // if (patterns.fragmentIds.includes(fragment._id.toString())) {
        //   continue;
        // }

        let totalScore = 0;
        let reasons = [];
        let metadata = {
          categoryScore: 0,
          titleSimilarityScore: 0,
          locationScore: 0,
          deviceScore: 0
        };

        // Category score
        if (categoryScores[fragment.category?._id]) {
          metadata.categoryScore = categoryScores[fragment.category._id];
          totalScore += metadata.categoryScore * 0.4;
          reasons.push('category_match');
        }

        // Title similarity score
        if (patterns.titles.length > 0) {
          metadata.titleSimilarityScore = await this.calculateTitleSimilarityScore(
            patterns.titles,
            fragment.title
          );
          totalScore += metadata.titleSimilarityScore * 0.3;
          if (metadata.titleSimilarityScore > 0.5) {
            reasons.push('title_similarity');
          }
        }

        // Location score
        metadata.locationScore = this.calculateLocationScore(patterns.locations);
        totalScore += metadata.locationScore * 0.1;

        // Device score
        metadata.deviceScore = this.calculateDeviceScore(patterns.devices);
        totalScore += metadata.deviceScore * 0.1;

        // Popularity boost
        const popularityScore = Math.min(fragment.viewCount / 1000, 0.2);
        totalScore += popularityScore * 0.1;

        // Include all fragments with their scores
        scoredFragments.push({
          fragment,
          score: totalScore,
          reason: reasons[0] || 'ai_recommended',
          metadata
        });
      }

      console.log({
        scoredFragments
      })
      // Sort by dateTime (createdAt) and suggestionConfidence (score)
      scoredFragments.sort((a, b) => {
        // First sort by score (suggestionConfidence) in descending order
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // If scores are equal, sort by createdAt (dateTime) in descending order
        return new Date(b.fragment.createdAt) - new Date(a.fragment.createdAt);
      });

      // Apply limit if specified, otherwise return all
      const recommendations = limit ? scoredFragments.slice(0, limit) : scoredFragments;

      // Get AI explanations for recommendations
      for (const rec of recommendations) {
        rec.metadata.aiExplanation = await this.getAIExplanation(
          patterns,
          rec.fragment,
          rec.score,
          rec.reason
        );
      }

      return recommendations;
    } catch (error) {
      console.error("Error generating recommendations:", error);
      return await this.getPopularFragments(limit);
    }
  }

  // Get popular fragments as fallback
  async getPopularFragments(limit = 20) {
    const query = FragmentModel.find({
      isDeleted: false,
      status: "published"
    })
    .sort({ viewCount: -1, createdAt: -1 })
    .populate("category", "name color")
    .populate("author", "name username");

    // Apply limit only if specified
    if (limit) {
      query.limit(limit);
    }

    const fragments = await query.lean();

    return fragments.map(fragment => ({
      fragment,
      score: 0.5,
      reason: 'popular',
      metadata: {
        categoryScore: 0,
        titleSimilarityScore: 0,
        locationScore: 0,
        deviceScore: 0,
        aiExplanation: "Popular fragment you might enjoy"
      }
    }));
  }

  // Save recommendations to database
  async saveRecommendations(userId, recommendations) {
    const bulkOps = recommendations.map(rec => ({
      updateOne: {
        filter: { userId, fragmentId: rec.fragment._id },
        update: {
          $set: {
            score: rec.score,
            reason: rec.reason,
            metadata: rec.metadata,
            lastRecommended: new Date()
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await UserFragmentModel.bulkWrite(bulkOps);
    }
  }

  // Get stored recommendations for a user
  async getStoredRecommendations(userId, limit = 20) {
    const recommendations = await UserFragmentModel.find({ userId })
      .sort({ score: -1, lastRecommended: -1 })
      .limit(limit)
      .populate({
        path: 'fragmentId',
        match: { isDeleted: false, status: "published" },
        populate: [
          { path: 'category', select: 'name color' },
          { path: 'author', select: 'name username' }
        ]
      })
      .lean();

    return recommendations.filter(rec => rec.fragmentId); // Filter out deleted fragments
  }
}

module.exports = new FragmentRecommendationEngine(); 