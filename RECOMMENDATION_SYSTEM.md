# Fragment Recommendation System

## Overview

The Fragment Recommendation System is an AI-powered personalized content recommendation engine that analyzes user behavior patterns and suggests relevant fragments to users. The system uses machine learning and user activity data to create tailored recommendations.

## Features

### 🧠 AI-Powered Recommendations
- **Category-based matching**: Analyzes user's preferred categories
- **Title similarity**: Uses AI to find similar content based on titles
- **Location-based suggestions**: Considers user's geographical location
- **Device optimization**: Adapts recommendations based on user's device
- **Popularity boost**: Includes trending and popular content

### 📊 User Activity Analysis
- Tracks user interactions over the last 30 days
- Analyzes fragment views, clicks, and engagement patterns
- Monitors category preferences and content consumption habits
- Records device and location patterns

### 🔄 Automated Job System
- Runs every 10 minutes automatically
- Processes recommendations in batches for performance
- Handles new users with popular content fallback
- Cleans up old recommendations automatically

## Architecture

### Models

#### UserFragment Model
```javascript
{
  userId: ObjectId,           // Reference to user
  fragmentId: ObjectId,       // Reference to fragment
  score: Number,              // Recommendation score (0-1)
  reason: String,             // Why it was recommended
  metadata: {
    categoryScore: Number,    // Category match score
    titleSimilarityScore: Number, // AI similarity score
    locationScore: Number,    // Location relevance
    deviceScore: Number,      // Device optimization
    aiExplanation: String     // AI-generated explanation
  },
  isViewed: Boolean,          // User viewed this recommendation
  isClicked: Boolean,         // User clicked this recommendation
  lastRecommended: Date       // When last recommended
}
```

### Components

1. **FragmentRecommendationEngine** (`utils/fragmentRecommendation.js`)
   - Core recommendation logic
   - AI-powered similarity scoring
   - User pattern analysis

2. **RecommendationJobService** (`services/recommendationJob.js`)
   - Scheduled job management
   - Batch processing
   - Database operations

3. **RecommendationController** (`controllers/recommendationController.js`)
   - API endpoints
   - User interaction tracking
   - Statistics and analytics

## API Endpoints

### User Endpoints

#### Get Personalized Recommendations
```http
GET /recommendations/user?limit=20&forceRefresh=false&page=1
Authorization: Bearer <token>
```

Response:
```json
{
  "recommendations": [
    {
      "_id": "fragment_id",
      "title": "Fragment Title",
      "description": "Fragment description",
      "content": "Fragment content",
      "category": { "name": "Science", "color": "#ff0000" },
      "author": { "name": "John Doe", "username": "johndoe" },
      "recommendationScore": 0.85,
      "recommendationReason": "category_match",
      "aiExplanation": "Based on your interest in physics topics"
    }
  ],
  "total": 50,
  "page": 1,
  "pages": 3,
  "hasMore": true
}
```

#### Mark Recommendation as Viewed
```http
POST /recommendations/view/:fragmentId
Authorization: Bearer <token>
```

#### Mark Recommendation as Clicked
```http
POST /recommendations/click/:fragmentId
Authorization: Bearer <token>
```

#### Get Recommendation Statistics
```http
GET /recommendations/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "totalRecommendations": 150,
  "viewedRecommendations": 89,
  "clickedRecommendations": 45,
  "averageScore": 0.72,
  "engagementRate": 30.0
}
```

#### Get Similar Fragments
```http
GET /recommendations/similar/:fragmentId?limit=10
Authorization: Bearer <token>
```

### Admin Endpoints

#### Trigger Recommendation Job
```http
POST /recommendations/admin/trigger-job
Authorization: Bearer <token>
```

#### Get Job Status
```http
GET /recommendations/admin/job-status
Authorization: Bearer <token>
```

#### Cleanup Old Recommendations
```http
DELETE /recommendations/admin/cleanup
Authorization: Bearer <token>
```

## How It Works

### 1. Data Collection
The system collects user activity data through events:
- Fragment views and clicks
- Category interactions
- Device and location information
- Time-based patterns

### 2. Pattern Analysis
For each user, the system analyzes:
- **Category preferences**: Most visited categories
- **Content similarity**: AI-powered title similarity analysis
- **Geographic patterns**: Location-based preferences
- **Device usage**: Mobile vs desktop preferences
- **Engagement patterns**: View vs click ratios

### 3. Scoring Algorithm
Each fragment gets scored based on:
- **Category Match (40%)**: User's category preferences
- **Title Similarity (30%)**: AI-powered content similarity
- **Location Relevance (10%)**: Geographic preferences
- **Device Optimization (10%)**: Device-specific content
- **Popularity Boost (10%)**: Trending content

### 4. AI Integration
The system uses OpenAI's GPT-4o-mini for:
- **Title similarity scoring**: Semantic analysis of content
- **Personalized explanations**: Why content is recommended
- **Content understanding**: Deep analysis of fragment topics

### 5. Recommendation Generation
1. Analyze user's recent activity (last 30 days)
2. Calculate scores for all available fragments
3. Filter out recently viewed content
4. Sort by recommendation score
5. Generate AI explanations for top recommendations
6. Store recommendations in database

### 6. Continuous Learning
The system improves over time by:
- Tracking user interactions with recommendations
- Adjusting scores based on engagement
- Learning from successful recommendations
- Adapting to changing user preferences

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
```

### Job Scheduling
The recommendation job runs every 6 hours by default. You can modify the schedule in `services/recommendationJob.js`:

```javascript
// Run every 6 hours
cron.schedule('0 */6 * * *', () => {
  this.runRecommendationJob();
});
```

### Performance Settings
- **Batch size**: 10 users per batch
- **Max recommendations**: 50 per user
- **Activity window**: 30 days
- **Cleanup threshold**: 30 days for old recommendations

## Usage Examples

### Frontend Integration

```javascript
// Get user recommendations
const getRecommendations = async () => {
  const response = await fetch('/api/recommendations/user?limit=20', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.recommendations;
};

// Mark recommendation as viewed
const markViewed = async (fragmentId) => {
  await fetch(`/api/recommendations/view/${fragmentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

// Mark recommendation as clicked
const markClicked = async (fragmentId) => {
  await fetch(`/api/recommendations/click/${fragmentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};
```

### Admin Dashboard

```javascript
// Trigger manual job run
const triggerJob = async () => {
  await fetch('/api/recommendations/admin/trigger-job', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
};

// Get job status
const getJobStatus = async () => {
  const response = await fetch('/api/recommendations/admin/job-status', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};
```

## Monitoring and Analytics

### Key Metrics
- **Recommendation accuracy**: Click-through rates
- **User engagement**: View vs click ratios
- **Category performance**: Which categories perform best
- **AI effectiveness**: Similarity score accuracy
- **Job performance**: Processing time and success rates

### Logs
The system provides detailed logging:
- Job execution status
- User processing progress
- Error handling and recovery
- Performance metrics

## Troubleshooting

### Common Issues

1. **No recommendations for new users**
   - System falls back to popular content
   - Recommendations improve with user activity

2. **Low recommendation scores**
   - Check user activity data
   - Verify category assignments
   - Review AI API connectivity

3. **Job not running**
   - Check cron schedule
   - Verify database connectivity
   - Review error logs

### Performance Optimization

1. **Database indexes**: Ensure proper indexing on UserFragment collection
2. **Batch processing**: Adjust batch size based on server capacity
3. **Caching**: Consider Redis for frequently accessed recommendations
4. **AI rate limiting**: Implement proper rate limiting for OpenAI API calls

## Future Enhancements

- **Real-time recommendations**: Instant updates based on user actions
- **Collaborative filtering**: User-to-user similarity matching
- **Content-based filtering**: Deep content analysis
- **A/B testing**: Recommendation algorithm testing
- **Multi-language support**: International content recommendations
- **Advanced analytics**: Detailed user behavior insights 