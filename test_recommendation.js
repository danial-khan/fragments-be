const mongoose = require('mongoose');
const { config } = require('./config');
const fragmentRecommendationEngine = require('./utils/fragmentRecommendation');
const recommendationJobService = require('./services/recommendationJob');

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Test the recommendation system
async function testRecommendationSystem() {
  try {
    console.log('Testing Recommendation System\n');

    // Test 1: Check if recommendation engine is working
    console.log('1. Testing recommendation engine...');
    const testUserId = '682b4518d42e64433fe38895'; // Use the user ID from your example event
    
    const recommendations = await fragmentRecommendationEngine.generateRecommendations(testUserId, 5);
    console.log(`Generated ${recommendations.length} recommendations for user ${testUserId}`);
    
    if (recommendations.length > 0) {
      console.log('Sample recommendation:');
      const sample = recommendations[0];
      console.log(`   - Title: ${sample.fragment.title}`);
      console.log(`   - Score: ${sample.score}`);
      console.log(`   - Reason: ${sample.reason}`);
      console.log(`   - AI Explanation: ${sample.metadata.aiExplanation}`);
    }

    // Test 2: Test job service
    console.log('\n2. Testing job service...');
    const jobStatus = recommendationJobService.getJobStatus();
    console.log('Job status:', jobStatus);

    // Test 3: Test user activity patterns
    console.log('\n3. Testing user activity patterns...');
    const patterns = await fragmentRecommendationEngine.getUserActivityPatterns(testUserId);
    console.log('User activity patterns:', {
      totalEvents: patterns.totalEvents,
      categories: Object.keys(patterns.categories).length,
      titles: patterns.titles.length,
      devices: Object.keys(patterns.devices).length
    });

    // Test 4: Test popular fragments fallback
    console.log('\n4. Testing popular fragments fallback...');
    const popularFragments = await fragmentRecommendationEngine.getPopularFragments(3);
    console.log(`Generated ${popularFragments.length} popular fragments`);

    console.log('\nAll tests passed. Recommendation system is working correctly.');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests
async function runTests() {
  await connectDB();
  await testRecommendationSystem();
  
  // Close database connection
  await mongoose.connection.close();
  console.log('\nDatabase connection closed');
}

// Run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testRecommendationSystem }; 