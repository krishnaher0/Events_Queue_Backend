import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

// Load env vars (in case this module is imported before main dotenv.config)
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log Cloudinary config status (without exposing secrets)
console.log('Cloudinary configured:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing',
});

// Storage configuration for events
const eventStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'eventqueue/events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1200, height: 630, crop: 'fill', quality: 'auto' }],
  },
});

// Storage configuration for shop products
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'eventqueue/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'fill', quality: 'auto' }],
  },
});

// Storage configuration for venues
const venueStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'eventqueue/venues',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill', quality: 'auto' }],
  },
});

// Storage configuration for user avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'eventqueue/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 200, height: 200, crop: 'fill', quality: 'auto' }],
  },
});

// Multer upload instances
export const uploadEventImage = multer({
  storage: eventStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const uploadProductImage = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadVenueImage = multer({
  storage: venueStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});

// Helper function to delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Helper function to extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const matches = url.match(/\/eventqueue\/([^/]+)\/([^.]+)/);
  if (matches) {
    return `eventqueue/${matches[1]}/${matches[2]}`;
  }
  return null;
};

export default cloudinary;
