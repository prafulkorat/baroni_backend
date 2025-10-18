import User from '../models/User.js';
import Review from '../models/Review.js';

/**
 * Create a default 5 star rating for a new star
 * @param {string} starId - The ID of the new star
 * @returns {Promise<void>}
 */
export const createDefaultRating = async (starId) => {
  try {
    // Find the first admin user to use as the reviewer for default rating
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.warn('No admin user found for default rating. Creating system review without reviewer.');
      // Create a review without a reviewer (system review)
      await Review.create({
        reviewerId: null, // System review
        starId: starId,
        rating: 5,
        comment: 'Welcome to Baroni! This is your default rating as a new star.',
        reviewType: 'system',
        isVisible: false, // Default ratings are not visible to users
        isDefaultRating: true // Mark as default rating
      });
    } else {
      // Create a review with admin as reviewer
      await Review.create({
        reviewerId: adminUser._id,
        starId: starId,
        rating: 5,
        comment: 'Welcome to Baroni! This is your default rating as a new star.',
        reviewType: 'system',
        isVisible: false, // Default ratings are not visible to users
        isDefaultRating: true // Mark as default rating
      });
    }
    
    // Update the star's average rating and total reviews in User collection
    await User.findByIdAndUpdate(starId, {
      averageRating: 5.0,
      totalReviews: 1
    });
    
    console.log(`Default 5 rating created for star ${starId}`);
  } catch (error) {
    console.error('Error creating default rating:', error);
    // Don't throw error to avoid breaking the star creation process
  }
};
