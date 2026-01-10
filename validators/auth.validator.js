import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must be less than 50 characters'),
  email: z
    .string()
    .email('Please enter a valid email address'),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
});

export const verifyCodeSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^[0-9]+$/, 'Verification code must contain only numbers'),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      // Zod 4.x uses .issues instead of .errors
      if (error.issues && Array.isArray(error.issues)) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({ success: false, errors });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      }
    }
  };
};
