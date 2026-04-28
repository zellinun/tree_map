export type TreeProject = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TreePin = {
  id: string;
  project_id: string;
  pin_number: number;
  latitude: number;
  longitude: number;
  species_name: string;
  quantity: number;
  description: string | null;
  created_at: string;
};

export type PendingPin = Omit<TreePin, "id" | "created_at"> & {
  client_id: string;
  pending: true;
};
