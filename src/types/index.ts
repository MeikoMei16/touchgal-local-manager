export interface TouchGalResource {
  id: number;
  uniqueId: string;
  name: string;
  banner: string | null;
  platform: string;
  language: string;
  releasedDate: string | null;
  averageRating: number;
  tags: string[];
  alias: string[];
  favoriteCount: number;
  resourceCount: number;
  commentCount: number;
}

export interface TouchGalDetail extends TouchGalResource {
  introduction: string | null;
  company: string | null;
  vndbId: string | null;
  bangumiId: number | null;
  steamId: string | null;
  downloads: TouchGalDownload[];
}

export interface TouchGalDownload {
  id: number;
  name: string;
  size: string | null;
  url: string | null;
}

export interface TouchGalComment {
  id: number;
  content: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

export interface TouchGalFeedResponse {
  total: number;
  list: TouchGalResource[];
}
