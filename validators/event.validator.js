import { z } from 'zod';

export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  category: z.enum([
    'Business Seminar',
    'Social & Networking',
    'Sports & Fitness',
    'Food & Drink',
    'Workshops',
    'Arts & Culture',
    'Technology',
    'Health & Wellness',
    'Other'
  ], { errorMap: () => ({ message: 'Please select a valid category' }) }),
  date: z
    .string()
    .refine((date) => new Date(date) > new Date(), {
      message: 'Event date must be in the future',
    }),
  time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time (HH:MM)'),
  location: z
    .string()
    .min(3, 'Location must be at least 3 characters')
    .max(200, 'Location must be less than 200 characters'),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .default(0),
  capacity: z
    .number()
    .int()
    .min(1, 'Capacity must be at least 1')
    .optional(),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const validate = (schema) => (req, res, next) => {
  try {
    // Parse price and capacity as numbers if they come as strings
    if (req.body.price) req.body.price = Number(req.body.price);
    if (req.body.capacity) req.body.capacity = Number(req.body.capacity);
    if (req.body.isFeatured) req.body.isFeatured = req.body.isFeatured === 'true';

    schema.parse(req.body);
    next();
  } catch (error) {
    const errors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({ success: false, errors });
  }
};
