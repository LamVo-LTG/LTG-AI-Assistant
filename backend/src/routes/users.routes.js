const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticate, isAdmin);

// Pending users routes (must be before /:id to avoid route conflict)
router.get('/pending', usersController.getPendingUsers);
router.get('/pending/count', usersController.getPendingCount);
router.post('/:id/approve', usersController.approveUser);
router.post('/:id/reject', usersController.rejectUser);

// Standard CRUD routes
router.get('/', usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
