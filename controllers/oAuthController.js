const { config } = require("../config");
const UserModel = require("../database/models/user");

const google = async (req, res) => {
  const { method } = req.params;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.GOOGLE_CLIENT_ID}&redirect_uri=${config.REDIRECT_URI}/${method}&response_type=code&scope=profile email`;
  return res.redirect(url);
};

const callbackGoogle = async (req, res, next) => {
  const { method } = req.params;
  const { code } = req.query;
  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: `${REDIRECT_URI}/${method}`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    const { access_token: accessToken } = tokenData;
    logger.info(tokenData);

    // Use access_token or id_token to fetch user profile
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const profile = await profileResponse.json();

    if (profile && profile.email) {
      const user = await UserModel.findOne({ email: profile.email });
      if (!user && method === "register") {
        await UserModel.create({
          email: profile.email,
          fullName: profile.name,
          avatar: profile.picture,
          emailVerified: true,
          password: "12345678",
          provider: "google",
        });
        res.redirect(`${config.UI_BASE_URL}/register/oauth-success`);
      } else if (user && method === "register") {
        res.redirect(`${config.UI_BASE_URL}/register/oauth-already-registered`);
        return;
      }
      if (!user && method === "login") {
        res.redirect(`${config.UI_BASE_URL}/login/oauth-unregistered`);
        return;
      } else if (user && method === "login") {
        const token = jwt.sign(
          { userId: user._id, email: user.email },
          config.JWT_SECRET,
          { expiresIn: "7d" }
        );
        res.cookie("session-token", token, {
          maxAge: 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });
        res.redirect(`${config.UI_BASE_URL}/dashboard`);
        return;
      }
    }

    if (method === "login") {
      res.redirect(`${config.UI_BASE_URL}/login/oauth-failure`);
    } else {
      res.redirect(`${config.UI_BASE_URL}/register/oauth-failure`);
    }
  } catch (err) {
    logger.error(err);
    err.status = 400;
    next(err);
  }
};

module.exports.oAuthController = {
  google,
  callbackGoogle,
};
