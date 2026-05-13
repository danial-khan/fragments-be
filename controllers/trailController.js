const Trail = require('../database/models/trail');
const Fragment = require('../database/models/fragment');
const { errorResponse, serverError } = require('../utils/response');

const trailController = {
  // Suggest a new trail
  suggestTrail: async (req, res) => {
    try {
      const { fragmentId, trailId } = req.body;
      const suggestedBy = req.user._id;

      // Get the fragment to check its author and category
      const fragment = await Fragment.findById(fragmentId);
      if (!fragment) {
        return errorResponse(res, 404, 'Fragment not found.', 'NOT_FOUND');
      }

      // Get the trail fragment to check its category
      const trailFragment = await Fragment.findById(trailId);
      if (!trailFragment) {
        return errorResponse(res, 404, 'Trail fragment not found.', 'NOT_FOUND');
      }

      // Check if fragments are in the same category
      if (fragment.category.toString() !== trailFragment.category.toString()) {
        return errorResponse(res, 400, 'Trail must be from the same category.', 'VALIDATION_ERROR');
      }

      // Check if trail already exists
      const existingTrail = await Trail.findOne({
        fragmentId,
        trailId,
        status: { $in: ['pending', 'approved'] }
      });

      if (existingTrail) {
        return errorResponse(res, 409, 'Trail already suggested or approved.', 'CONFLICT');
      }

      const newTrail = new Trail({
        authorId: fragment.author,
        fragmentId,
        trailId,
        suggestedBy,
        status: fragment.author.toString() === suggestedBy.toString() ? 'approved' : 'pending'
      });

      await newTrail.save();

      res.status(201).json({
        message: 'Trail suggested successfully',
        trail: newTrail
      });
    } catch (err) {
      console.error('Suggest trail error:', err);
      serverError(res);
    }
  },

  // Get trails for a fragment
  getFragmentTrails: async (req, res) => {
    try {
      const { fragmentId } = req.params;
      const userId = req.user?._id;

      const fragment = await Fragment.findById(fragmentId);
      if (!fragment) {
        return errorResponse(res, 404, 'Fragment not found.', 'NOT_FOUND');
      }

      const query = { fragmentId };
      if (!userId || fragment.author.toString() !== userId.toString()) {
        query.status = 'approved';
      }

      const trails = await Trail.find(query)
        .populate('trailId', 'title description')
        .populate('suggestedBy', 'name')
        .sort({ createdAt: -1 });

      res.status(200).json(trails);
    } catch (err) {
      console.error('Get fragment trails error:', err);
      serverError(res);
    }
  },

  // Update trail status (approve/reject)
  updateTrailStatus: async (req, res) => {
    try {
      const { trailId } = req.params;
      const { status } = req.body;
      const userId = req.user._id;

      if (!['approved', 'rejected'].includes(status)) {
        return errorResponse(res, 400, 'Invalid status value.', 'VALIDATION_ERROR');
      }

      const trail = await Trail.findById(trailId);
      if (!trail) {
        return errorResponse(res, 404, 'Trail not found.', 'NOT_FOUND');
      }

      // Only fragment author can approve/reject trails
      if (trail.authorId.toString() !== userId.toString()) {
        return errorResponse(res, 403, 'You are not authorized to perform this action.', 'FORBIDDEN');
      }

      trail.status = status;
      await trail.save();

      res.status(200).json({
        message: `Trail ${status} successfully`,
        trail
      });
    } catch (err) {
      console.error('Update trail status error:', err);
      serverError(res);
    }
  },

  // Get trails for an author
  getAuthorTrails: async (req, res) => {
    try {
      if (!req.user?._id) {
        return res.status(200).json([]);
      }
      const userId = req.user._id;

      const trails = await Trail.find({ authorId: userId })
        .populate('fragmentId', 'title')
        .populate('trailId', 'title')
        .populate('suggestedBy', 'name')
        .sort({ createdAt: -1 });

      res.status(200).json(trails);
    } catch (err) {
      console.error('Get author trails error:', err);
      serverError(res);
    }
  }
};

module.exports = trailController; 