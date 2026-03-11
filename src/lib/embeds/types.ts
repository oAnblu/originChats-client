export type EmbedType =
  | "youtube"
  | "tenor"
  | "github_user"
  | "github_org"
  | "github_repo"
  | "github_commit"
  | "video"
  | "image"
  | "gift"
  | "unknown";

export interface EmbedInfo {
  type: EmbedType;
  url: string;
  videoId?: string;
  tenorId?: string;
  giftCode?: string;
  owner?: string;
  repo?: string;
  sha?: string;
  path?: string;
}
