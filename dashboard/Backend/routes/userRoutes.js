const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");


// REGISTER USER
router.post("/register", registerUser);


// LOGIN USER
router.post("/login", loginUser);


// GET ALL USERS
router.get("/", authMiddleware, getUsers);


// GET USER BY ID
router.get("/:id", authMiddleware, getUserById);


// UPDATE USER
router.put("/:id", authMiddleware, updateUser);


// DELETE USER
router.delete("/:id", authMiddleware, deleteUser);

module.exports = router;