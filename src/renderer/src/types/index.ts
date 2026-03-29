import { z } from 'zod';
import { 
  TouchGalResourceSchema, 
  TouchGalDetailSchema, 
  TouchGalDownloadSchema, 
  TouchGalCommentSchema, 
  TouchGalFeedResponseSchema 
} from '../schemas';

export type TouchGalResource = z.infer<typeof TouchGalResourceSchema>;
export type TouchGalDetail = z.infer<typeof TouchGalDetailSchema>;
export type TouchGalDownload = z.infer<typeof TouchGalDownloadSchema>;
export type TouchGalComment = z.infer<typeof TouchGalCommentSchema>;
export type TouchGalFeedResponse = z.infer<typeof TouchGalFeedResponseSchema>;
