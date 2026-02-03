export type ClientCategory = 'laboratorio' | 'chino';
export type ClientType = 'dropshipper' | 'mixto' | 'ecommerce';
export type ClientStatus = 'finding_winner' | 'testing' | 'selling' | 'scaling';

export interface CommercialClient {
  id?: string;
  name: string;
  email: string;
  phone: string;
  birthday: Date |  any; // Timestamp from Firestore often needs handling
  category: ClientCategory;
  type: ClientType;
  avg_sales: number;
  city: string;
  status: ClientStatus;
  assigned_commercial_id: string; 
  products_testing?: string[];
  products_selling?: string[];
  created_at: Date | any;
  updated_at?: Date | any;
}

export type ChallengeType = 'daily' | 'monthly';

export interface CommercialChallenge {
  id?: string;
  title: string;
  description: string;
  type: ChallengeType;
  reward: string;
  is_active: boolean;
  created_by: string;
  created_at: Date | any;
}

export type RatingType = 'star' | 'angry';

export interface CommercialRating {
  id?: string;
  from_user_id: string;
  to_user_id: string;
  type: RatingType; // 'star' is +1, 'angry' is -1 or just negative sentiment
  created_at: Date | any;
}

export type ResourceType = 'video' | 'article' | 'podcast';

export interface AcademyResource {
  id?: string;
  title: string;
  description?: string;
  type: ResourceType;
  url: string; // YouTube link, article URL, etc.
  thumbnail?: string;
  created_at: Date | any;
}

// Stats interface for the Commercial Director Dashboard
export interface CommercialStats {
  userId: string;
  userName: string;
  totalClients: number;
  newClientsThisMonth: number;
  activeClients: number; // e.g. status != finding_winner ?? or specific rule
  totalBilling: number;
  starCount: number;
  angryCount: number;
}
