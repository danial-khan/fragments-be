const UserModel = require("../database/models/user");
const FragmentModel = require("../database/models/fragment");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserCredentialsModel = require("../database/models/userCredentials");
const { mongoose } = require("mongoose");

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
      isDeleted: false,
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

    res.cookie("admin-token", token, {
      domain:
        process.env.NODE_ENV === "production"
          ? ".fragmenttrails.com"
          : "localhost",
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
    const { name, email, type, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password fields are required." });
    }

    const existingUser = await UserModel.findOne({ email, isDeleted: false });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "A moderator with this email already exists." });
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const baseUsername = slugify(name);
    let username = baseUsername;
    let counter = 1;

    while (await UserModel.findOne({ username })) {
      username = `${baseUsername}-${counter++}`;
    }

    await UserModel.create({
      name,
      email,
      username,
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
      isDeleted: false,
    });
    const inActiveAuthors = await UserCredentialsModel.countDocuments({
      type: "author",
      status: {
        $ne: "approved",
      },
      isDeleted: false,
    });
    const activeStudents = await UserCredentialsModel.countDocuments({
      type: "student",
      status: "approved",
      isDeleted: false,
    });
    const inActiveStudents = await UserCredentialsModel.countDocuments({
      type: "student",
      status: {
        $ne: "approved",
      },
      isDeleted: false,
    });
    const totalActive = await UserModel.countDocuments({
      type: {
        $nin: ["admin", "moderator"],
      },
      active: true,
      isDeleted: false,
    });
    const totalInactive = await UserModel.countDocuments({
      type: {
        $nin: ["admin", "moderator"],
      },
      active: false,
      isDeleted: false,
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
    const authors = await UserCredentialsModel.find({
      type: "author",
      isDeleted: false,
    })
      .limit(100)
      .populate("userId", "name email");
    return res.status(200).json({
      authors,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAuthorsFromUsersTable = async (req, res) => {
  try {
    const authors = await UserModel.find({ type: "author", isDeleted: false })
      .select("_id, name")
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
    const students = await UserCredentialsModel.find({
      type: "student",
      isDeleted: false,
    })
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

    const credentials = await UserCredentialsModel.find({
      isDeleted: false,
    });
    if (!credentials) {
      return res.status(400).json({ message: "Credentials not found." });
    }

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
          $nin: ["admin", "moderator"],
        },
        isDeleted: false,
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

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserModel.findById(userId)
      .select("-password -verificationCode -resetCode")
      .populate("followers", "name")
      .populate("following", "name");

    if (!user) return res.status(404).json({ message: "User not found" });

    const credentials = await UserCredentialsModel.findOne({ userId });

    return res.json({ user, credentials });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching user details" });
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
      fragmentId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    if (fragmentId && !mongoose.Types.ObjectId.isValid(fragmentId)) {
      return res.status(200).json({
        fragments: [],
        total: 0,
        page: parseInt(page, 10),
        pages: 0,
      });
    }

    const match = { isDeleted: false };
    if (fragmentId) match._id = new mongoose.Types.ObjectId(fragmentId);
    if (category) match.category = new mongoose.Types.ObjectId(category);
    if (author) match.author = new mongoose.Types.ObjectId(author);
    if (status === "published" || status === "blocked") {
      match.status = status;
    } else {
      match.status = { $ne: "draft" };
    }
    if (search) {
      match.$text = { $search: search };
    }

    let fragments;
    let total;

    if (sortBy === "upvotes") {
      const pipeline = [
        { $match: match },
        {
          $addFields: {
            upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
          },
        },
        { $sort: { upvoteCount: sortOrder === "desc" ? -1 : 1 } },
        { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
        { $limit: parseInt(limit, 10) },
      ];

      const aggResults = await FragmentModel.aggregate(pipeline);

      fragments = await FragmentModel.populate(aggResults, [
        { path: "author", select: "name" },
        { path: "category", select: "name" },
      ]);

      total = await FragmentModel.countDocuments(match);
    } else {
      const sortField = sortBy === "views" ? "viewCount" : sortBy;
      const direction = sortOrder === "desc" ? -1 : 1;

      fragments = await FragmentModel.find(match)
        .sort({ [sortField]: direction })
        .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
        .limit(parseInt(limit, 10))
        .populate("author", "name")
        .populate("category", "name");

      total = await FragmentModel.countDocuments(match);
    }

    return res.status(200).json({
      fragments,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    console.error("Get fragments error:", err);
    return res.status(500).json({ error: err.message });
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
      fragmentId,
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
      authorMap[String(user._id)] = {
        _id: String(user._id),
        name: user.name,
      };
    });

    allReplies.forEach((reply) => {
      reply.author = authorMap[reply.authorId] || {
        _id: reply.authorId,
        name: null,
      };
    });

    let filtered = allReplies;

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (author) {
      filtered = filtered.filter((r) => String(r.authorId) === String(author));
    }

    if (fragmentId) {
      filtered = filtered.filter(
        (r) => String(r.fragmentId) === String(fragmentId)
      );
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

    console.log("Toggle reply status:", { fragmentId, replyId, status });

    const fragment = await FragmentModel.findOne({
      _id: fragmentId,
      isDeleted: false,
    });
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

    const user = await UserModel.findOne({
      _id: userId,
      isDeleted: false,
      type: { $in: ["admin", "moderator"] },
    });
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

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

    const fragment = await FragmentModel.findOne({
      _id: fragmentId,
      isDeleted: false,
    });
    if (!fragment) {
      return res.status(401).json({ message: "Fragment not found." });
    }

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

const softDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserModel.findOne({
      _id: userId,
      isDeleted: false,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await UserModel.updateOne({ _id: userId }, { $set: { isDeleted: true, active: false } });

    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const softDeleteAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;

    const author = await UserCredentialsModel.findOne({
      _id: authorId,
      isDeleted: false,
    });
    if (!author) {
      return res.status(404).json({
        success: false,
        message: "Author not found or already deleted",
      });
    }

    await UserCredentialsModel.updateOne(
      { _id: authorId },
      { $set: { isDeleted: true, status: "rejected" } }
    );

    return res
      .status(200)
      .json({ success: true, message: "Author deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const softDeleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await UserCredentialsModel.findOne({
      _id: studentId,
      isDeleted: false,
    });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    await UserCredentialsModel.updateOne(
      { _id: studentId },
      { $set: { isDeleted: true, status: "rejected" } }
    );

    return res
      .status(200)
      .json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const softDeleteFragment = async (req, res) => {
  try {
    const { fragmentId } = req.params;

    const fragment = await FragmentModel.findOne({
      _id: fragmentId,
      isDeleted: false,
    });
    if (!fragment) {
      return res
        .status(404)
        .json({ success: false, message: "Fragment not found" });
    }

    await FragmentModel.updateOne(
      { _id: fragmentId },
      { $set: { isDeleted: true, status: "blocked" } }
    );

    return res
      .status(200)
      .json({ success: true, message: "Fragment deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const softDeleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const { fragmentId } = req.body;

    const fragment = await FragmentModel.findOne({
      _id: fragmentId,
      isDeleted: false,
    });
    if (!fragment) {
      return res
        .status(404)
        .json({ success: false, message: "Fragment not found" });
    }

    let found = false;

    const updateNestedReplyStatus = (replies) => {
      return replies.map((reply) => {
        if (reply._id.toString() === replyId.toString()) {
          reply.isDeleted = true;
          reply.status = "blocked";
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

    return res
      .status(200)
      .json({ success: true, message: "Fragment deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
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
  getUserDetails,
  getAllFragmentsForAdmin,
  getAllCommentsForAdmin,
  updateUserStatus,
  updateFragmentStatus,
  toggleReplyStatus,
  softDeleteUser,
  softDeleteAuthor,
  softDeleteStudent,
  softDeleteFragment,
  softDeleteReply,
};
