  import express from 'express';
import { body } from 'express-validator';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { idParamValidator, paginationQueryValidator, appointmentStatusQueryValidator } from '../../validators/commonValidators.js';
import { createAppointment, listAppointments, approveAppointment, rejectAppointment, cancelAppointment, rescheduleAppointment, completeAppointment, getAppointmentDetails } from '../../controllers/appointment.js';

const router = express.Router();

router.use(requireAuth);

const createAppointmentValidator = [
  body('starId').isMongoId(),
  body('availabilityId').isMongoId(),
  body('timeSlotId').isMongoId(),
  body('price').isNumeric().withMessage('Price must be a number').isFloat({ min: 0 }).withMessage('Price must be greater than or equal to 0'),
];

const rescheduleAppointmentValidator = [
  body('availabilityId').isMongoId().withMessage('Invalid availability ID'),
  body('timeSlotId').isMongoId().withMessage('Invalid time slot ID'),
];

router.post('/', createAppointmentValidator, createAppointment);
router.get('/', [...paginationQueryValidator, ...appointmentStatusQueryValidator], listAppointments);
router.get('/:id', idParamValidator, getAppointmentDetails);
router.post('/:id/approve', requireRole('star', 'admin'), idParamValidator, approveAppointment);
router.post('/:id/reject', requireRole('star', 'admin'), idParamValidator, rejectAppointment);
router.post('/:id/cancel', idParamValidator, cancelAppointment);
router.post('/:id/reschedule', [
  idParamValidator,
  ...rescheduleAppointmentValidator
], (req, res, next) => {
  console.log('Reschedule route hit:', req.params.id);
  next();
}, rescheduleAppointment);

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Appointments router is working' });
});
router.post('/:id/complete', [
  idParamValidator,
  body('callDuration').isNumeric().withMessage('Call duration must be a number').isFloat({ min: 0 }).withMessage('Call duration must be greater than or equal to 0')
], completeAppointment);

export default router;




