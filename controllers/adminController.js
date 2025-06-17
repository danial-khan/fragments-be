const UserModel = require("../database/models/user");
const FragmentModel = require("../database/models/fragment");
const FragmentModel = require("../database/models/fragment");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserCredentialsModel = require("../database/models/userCredentials");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await UserModel.findOne({
      email,
      type: { $in: ["admin", "moderator"] },
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(password).digest("hex"),
        "utf8"
      )
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const { name, email: userEmail, type, avatar, _id: userId } = user.toJSON();
    const token = jwt.sign(
      { _id: userId, name, email: userEmail, avatar, type },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("session-token", token, {
      domain:
        process.env.NODE_ENV === "production" ? ".fragmenttrails.com" : "localhost",
      sameSite: "None",
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...restUser } = user?.toJSON() || {};

    return res.status(200).json({
      user: restUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password fields are required." });
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    await UserModel.create({
      name,
      email,
      password: hashedPassword,
      type: "moderator",
      active: true,
    });

    return res.status(201).json({ message: "Moderator registered!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "something went wrong" });
  }
};

const getSession = (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({ user: user });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const getStats = async (_req, res) => {
  try {
    const activeAuthors = await UserCredentialsModel.countDocuments({
      type: "author",
      status: "approved",
    });
    const inActiveAuthors = await UserCredentialsModel.countDocuments({
      type: "author",
      status: {
        $ne: "approved",
      },
    });
    const activeStudents = await UserCredentialsModel.countDocuments({
      type: "student",
      status: "approved",
    });
    const inActiveStudents = await UserCredentialsModel.countDocuments({
      type: "student",
      status: {
        $ne: "approved",
      },
    });
    const totalActive = await UserModel.countDocuments({
      type: {
        $nin: ["admin", "moderator"],
      },
      active: true,
    });
    const totalInactive = await UserModel.countDocuments({
      type: {
        $nin: ["admin", "moderator"],
      },
      active: false,
    });
    return res.status(200).json({
      activeAuthors,
      inActiveAuthors,
      activeStudents,
      inActiveStudents,
      totalActive,
      totalInactive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAuthors = async (req, res) => {
  try {
    const authors = await UserCredentialsModel.find({ type: "author" })
      .limit(100)
      .populate("userId", "name, email");
    return res.status(200).json({
      authors,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAuthorsFromUsersTable = async (req, res) => {
  try {
    const authors = await UserModel.find({ type: "author" })
      .select("_i0d, name")
      .exec();
    return res.status(200).json({
      authors,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await UserCredentialsModel.find({ type: "student" })
      .limit(100)
      .populate("userId", "name, email");
    return res.status(200).json({
      students,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateCredentialsStatus = async (req, res) => {
  try {
    const { credentialsId } = req.body;
    const { status } = req.params;
    await UserCredentialsModel.updateOne(
      { _id: credentialsId },
      { $set: { status } }
    );
    return res.status(200).json({
      success: true,
      message: "status updateds successfully",
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await UserModel.find(
      {
        type: {
          $nin: ["admin"],
        },
      },
      "-password"
    ).exec();

    return res.status(200).json({
      users,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAllFragmentsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      author,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      idne,
    } = req.query;

    const query = { isDeleted: false };

    if (idne) {
      query._id = { $ne: idne };
    }

    if (category) {
      query.category = category;
    }

    if (author) {
      query.author = author;
    }

    if (status === "published" || status === "blocked") {
      query.status = status;
    } else {
      query.status = { $ne: "draft" };
    }

    if (search) {
      query.$text = { $search: search };
    }

    const sortOptions = {};
    if (sortBy === "views") {
      sortOptions["viewCount"] = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "upvotes") {
      sortOptions["upvotes.size"] = sortOrder === "desc" ? 1 : -1;
    } else {
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    }

    const fragments = await FragmentModel.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("author", "name")
      .populate("category", "name");

    const total = await FragmentModel.countDocuments(query);

    res.status(200).json({
      fragments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("Get fragments error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllCommentsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      author,
      category,
      search,
      depth,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const fragments = await FragmentModel.find({ isDeleted: false })
      .populate("category", "name")
      .lean();

    const allReplies = [];
    const allAuthorIds = new Set();

    const collectReplies = (
      replies,
      fragment,
      currentDepth = 1,
      parentReplyId = null
    ) => {
      if (currentDepth > 3) return;

      replies.forEach((reply) => {
        const authorId = reply.author;
        if (authorId) allAuthorIds.add(String(authorId));

        allReplies.push({
          _id: reply._id,
          content: reply.content,
          authorId: String(authorId),
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          status: reply.status,
          review: reply.review,
          fragmentId: fragment._id,
          fragmentTitle: fragment.title,
          categoryId: fragment.category?._id || null,
          categoryName: fragment.category?.name || "Uncategorized",
          parentReplyId,
          depth: currentDepth,
        });

        if (reply.replies && reply.replies.length > 0) {
          collectReplies(reply.replies, fragment, currentDepth + 1, reply._id);
        }
      });
    };

    for (const fragment of fragments) {
      collectReplies(fragment.replies || [], fragment);
    }

    const authorList = await UserModel.find({
      _id: { $in: Array.from(allAuthorIds) },
    })
      .select("_id name")
      .lean();

    const authorMap = {};
    authorList.forEach((user) => {
      authorMap[String(user._id)] = user.name;
    });

    allReplies.forEach((reply) => {
      reply.authorName = authorMap[reply.authorId] || null;
    });

    let filtered = allReplies;

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (author) {
      filtered = filtered.filter((r) => String(r.authorId) === String(author));
    }

    if (category) {
      filtered = filtered.filter(
        (r) => String(r.categoryId) === String(category)
      );
    }

    if (depth) {
      const numericDepth = parseInt(depth);
      if ([1, 2, 3].includes(numericDepth)) {
        filtered = filtered.filter((r) => r.depth === numericDepth);
      }
    }

    if (search) {
      filtered = filtered.filter((r) =>
        r.content.toLowerCase().includes(search.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];

      if (sortBy === "createdAt" || sortBy === "updatedAt") {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (sortBy === "depth") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    const total = filtered.length;
    const paginated = filtered.slice(
      (page - 1) * limit,
      (page - 1) * limit + parseInt(limit)
    );

    res.status(200).json({
      replies: paginated,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("Admin get replies error:", err);
    res.status(500).json({ error: err.message });
  }
};

const toggleReplyStatus = async (req, res) => {
  try {
    const { fragmentId, replyId } = req.body;
    let { status } = req.params;

    const fragment = await FragmentModel.findById(fragmentId);
    if (!fragment) {
      return res.status(404).json({ error: "Fragment not found" });
    }

    let found = false;

    const updateNestedReplyStatus = (replies) => {
      return replies.map((reply) => {
        if (reply._id.toString() === replyId.toString()) {
          reply.status = status;
          found = true;
        }
        if (reply.replies && reply.replies.length) {
          reply.replies = updateNestedReplyStatus(reply.replies);
        }
        return reply;
      });
    };

    fragment.replies = updateNestedReplyStatus(fragment.replies);

    if (!found) {
      return res.status(404).json({ error: "Reply not found at any depth" });
    }

    fragment.markModified("replies");

    await fragment.save();

    return res.status(200).json({
      message: `Reply status updated to "${status}" successfully`,
    });
  } catch (err) {
    console.error("Toggle reply status error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.body;
    const { status } = req.params;
    await UserModel.updateOne(
      { _id: userId },
      { $set: { active: status === "active" } }
    );
    return res.status(200).json({
      success: true,
      message: "status updateds successfully",
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateFragmentStatus = async (req, res) => {
  try {
    const { fragmentId } = req.body;
    const { status } = req.params;

    await FragmentModel.updateOne({ _id: fragmentId }, { $set: { status } });

    return res.status(200).json({
      success: true,
      message: `Fragment ${status} successfully`,
    });
  } catch (error) {
    console.error("Error updating fragment status:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports.adminController = {
  login,
  register,
  getSession,
  getStats,
  getAuthors,
  getAuthorsFromUsersTable,
  getStudents,
  updateCredentialsStatus,
  getUsers,
  getAllFragmentsForAdmin,
  getAllCommentsForAdmin,
  updateUserStatus,
  updateFragmentStatus,
  toggleReplyStatus,
};
