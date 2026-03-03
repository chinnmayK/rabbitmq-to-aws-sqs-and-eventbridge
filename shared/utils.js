const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports.GenerateSalt = async () => bcrypt.genSalt();

module.exports.GeneratePassword = async (password, salt) =>
    bcrypt.hash(password, salt);

module.exports.ValidatePassword = async (enteredPassword, savedPassword, salt) => {
    if (salt) {
        return (await bcrypt.hash(enteredPassword, salt)) === savedPassword;
    }
    return await bcrypt.compare(enteredPassword, savedPassword);
};

module.exports.GenerateSignature = async (payload, secret) =>
    jwt.sign(payload, secret, { expiresIn: "30d" });

module.exports.ValidateSignature = async (req, secret) => {
    try {
        const signature = req.get("Authorization");
        if (!signature) return false;
        const payload = jwt.verify(signature.split(" ")[1], secret);
        req.user = payload;
        return true;
    } catch {
        return false;
    }
};

module.exports.FormateData = (data) => {
    if (data) return { data };
    throw new Error("Data Not found!");
};
