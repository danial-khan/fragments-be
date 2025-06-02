const Trail = require('../database/models/trail');
const Fragment = require('../database/models/fragment');

const trailController = {
  // Suggest a new trail
  suggestTrail: async (req, res) => {
    try {
      const { fragmentId, trailId } = req.body;
      const suggestedBy = req.user._id;

      // Get the fragment to check its author and category
      const fragment = await Fragment.findById(fragmentId);
      if (!fragment) {
        return res.status(404).json({ error: 'Fragment not found' });
      }

      // Get the trail fragment to check its category
      const trailFragment = await Fragment.findById(trailId);
      if (!trailFragment) {
        return res.status(404).json({ error: 'Trail fragment not found' });
      }

      // Check if fragments are in the same category
      if (fragment.category.toString() !== trailFragment.category.toString()) {
        return res.status(400).json({ error: 'Trail must be from the same category' });
      }

      // Check if trail already exists
      const existingTrail = await Trail.findOne({
        fragmentId,
        trailId,
        status: { $in: ['pending', 'approved'] }
      });

      console.log(existingTrail)

      if (existingTrail) {
        return res.status(400).json({ error: 'Trail already suggested or approved' });
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
      res.status(500).json({ error: err.message });
    }
  },

  // Get trails for a fragment
  getFragmentTrails: async (req, res) => {
    try {
      const { fragmentId } = req.params;
      const userId = req.user._id;

      const fragment = await Fragment.findById(fragmentId);
      if (!fragment) {
        return res.status(404).json({ error: 'Fragment not found' });
      }

      // If user is not the author, only show approved trails
      const query = { fragmentId };
      if (fragment.author.toString() !== userId.toString()) {
        query.status = 'approved';
      }

      const trails = await Trail.find(query)
        .populate('trailId', 'title description')
        .populate('suggestedBy', 'name')
        .sort({ createdAt: -1 });

      res.status(200).json(trails);
    } catch (err) {
      console.error('Get fragment trails error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  // Update trail status (approve/reject)
  updateTrailStatus: async (req, res) => {
    try {
      const { trailId } = req.params;
      const { status } = req.body;
      const userId = req.user._id;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const trail = await Trail.findById(trailId);
      if (!trail) {
        return res.status(404).json({ error: 'Trail not found' });
      }

      // Only fragment author can approve/reject trails
      if (trail.authorId.toString() !== userId.toString()) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      trail.status = status;
      await trail.save();

      res.status(200).json({
        message: `Trail ${status} successfully`,
        trail
      });
    } catch (err) {
      console.error('Update trail status error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  // Get trails for an author
  getAuthorTrails: async (req, res) => {
    try {
      const userId = req.user._id;

      const trails = await Trail.find({ authorId: userId })
        .populate('fragmentId', 'title')
        .populate('trailId', 'title')
        .populate('suggestedBy', 'name')
        .sort({ createdAt: -1 });

      res.status(200).json(trails);
    } catch (err) {
      console.error('Get author trails error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = trailController; 