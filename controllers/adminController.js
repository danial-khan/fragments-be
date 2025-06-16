const UserModel = require("../database/models/user");
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
        process.env.NODE_ENV === "production" ? ".mernsol.com" : "localhost",
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
      sortOptions["upvotes.length"] = sortOrder === "desc" ? -1 : 1;
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
    let {
      page = 1, limit = 10,
      fragment: fragmentId,
      author, status, category: categoryId,
      search, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    page  = Number(page);
    limit = Number(limit);

    const fragments = await FragmentModel.find({ isDeleted: false })
      .select("title category replies")
      .populate("category", "name")
      .populate({
        path: "replies",
        match: { isDeleted: false },
        populate: [
          {
            path: "author",
            select: "name",
          },
          {
            path: "replies",
            match: { isDeleted: false },
            populate: [
              {
                path: "author",
                select: "name",
              },
              {
                path: "replies",
                match: { isDeleted: false },
                populate: {
                  path: "author",
                  select: "name",
                },
              },
            ],
          },
        ],
      });


    let comments = fragments.flatMap(frag =>
      frag.replies
        .filter(r1 => !r1.isDeleted)
        .map(r1 => ({
          _id: r1._id,
          content: r1.content,
          author: { _id: r1.author._id, name: r1.author.name },
          status: r1.status,
          createdAt: r1.createdAt,
          upvoteCount:   r1.upvotes.length,
          downvoteCount: r1.downvotes.length,

          fragmentId:           frag._id,
          fragmentTitle:        frag.title,
          fragmentCategoryId:   frag.category._id.toString(),
          fragmentCategoryName: frag.category.name,

          repliesLevel2: r1.replies
            .filter(r2 => !r2.isDeleted)
            .map(r2 => ({
              _id: r2._id,
              content: r2.content,
              author: { _id: r2.author._id, name: r2.author.name },
              status:      r2.status,
              createdAt:   r2.createdAt,
              upvoteCount:   r2.upvotes.length,
              downvoteCount: r2.downvotes.length,

              repliesLevel3: r2.replies
                .filter(r3 => !r3.isDeleted)
                .map(r3 => ({
                  _id: r3._id,
                  content: r3.content,
                  author: { _id: r3.author._id, name: r3.author.name },
                  status:      r3.status,
                  createdAt:   r3.createdAt,
                  upvoteCount:   r3.upvotes.length,
                  downvoteCount: r3.downvotes.length,
                })),
            })),
        }))
    );

    if (fragmentId) comments = comments.filter(c => c.fragmentId.toString() === fragmentId);
    if (author)     comments = comments.filter(c => c.author._id.toString() === author);
    if (status)     comments = comments.filter(c => c.status === status);
    if (categoryId) comments = comments.filter(c => c.fragmentCategoryId === categoryId);
    if (search) {
      const term = search.toLowerCase();
      comments = comments.filter(c => c.content.toLowerCase().includes(term));
    }

    const field = sortBy === 'upvoteCount' ? 'upvoteCount' : 'createdAt';
    comments.sort((a, b) => {
      const aVal = field === 'createdAt' ? a.createdAt.getTime() : a.upvoteCount;
      const bVal = field === 'createdAt' ? b.createdAt.getTime() : b.upvoteCount;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = comments.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paged = comments.slice(start, start + limit);

    return res.json({ comments: paged, total, page, pages });
  } catch (err) {
    console.error('Error fetching comments for admin:', err);
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
};
