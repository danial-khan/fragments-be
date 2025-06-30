const express = require("express");
const fragmentRouter = express.Router();

const fragmentController = require("../controllers/fragmentController");
const { authMiddleware } = require("../middlewares/auth");

// Fragment CRUD routes
fragmentRouter.post("/", authMiddleware, fragmentController.createFragment);
fragmentRouter.get("/", authMiddleware, fragmentController.getFragments);
fragmentRouter.get(
  "/profile/:username",
  authMiddleware,
  fragmentController.getPublicProfile
);
fragmentRouter.get(
  "/user",
  authMiddleware,
  fragmentController.getUserFragments
);
fragmentRouter.get(
  "/user-stats",
  authMiddleware,
  fragmentController.getUserFragmentsStats
);
fragmentRouter.get("/:id", authMiddleware, fragmentController.getFragment);
fragmentRouter.put("/:id", authMiddleware, fragmentController.updateFragment);
fragmentRouter.patch(
  "/:id/status/:status",
  authMiddleware,
  fragmentController.changeFragmentStatus
);
fragmentRouter.delete(
  "/:id",
  authMiddleware,
  fragmentController.deleteFragment
);
fragmentRouter.delete(
  "/:fragmentId/:replyId",
  authMiddleware,
  fragmentController.deleteReply
);

// Reply routes
fragmentRouter.post(
  "/:id/replies",
  authMiddleware,
  fragmentController.addReply
);

// Voting routes
fragmentRouter.post("/:id/vote", authMiddleware, fragmentController.vote);

module.exports = fragmentRouter;
