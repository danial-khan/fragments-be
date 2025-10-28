const express = require("express");
const fragmentRouter = express.Router();

const fragmentController = require("../controllers/fragmentController");
const { authMiddleware } = require("../middlewares/auth");
const { isEducatorMiddleware } = require("../middlewares/subscription");

// Fragment CRUD routes (create/update/delete require educator plan)
fragmentRouter.post("/", authMiddleware, isEducatorMiddleware, fragmentController.createFragment);
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
fragmentRouter.put("/:id", authMiddleware, isEducatorMiddleware, fragmentController.updateFragment);
fragmentRouter.patch(
  "/:id/status/:status",
  authMiddleware,
  isEducatorMiddleware,
  fragmentController.changeFragmentStatus
);
fragmentRouter.delete(
  "/:id",
  authMiddleware,
  isEducatorMiddleware,
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
