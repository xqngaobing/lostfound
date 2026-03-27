export type ItemCard = {
  id: string;
  code: string;
  title: string;
  category: string;
  images: string[];
  foundAt: string;
  locationText: string;
  status: "OPEN" | "CLAIMING" | "CLAIMED" | "REMOVED";
  createdAt: string;
  viewCount: number;
};

export type ItemDetail = ItemCard & {
  description: string;
};
