// Minimal shapes of the WooCommerce REST v3 resources we use.

export type WooImage = { id: number; src: string; name?: string; alt?: string };

export type WooMeta = { id?: number; key: string; value: unknown };

export type WooCategory = {
  id:          number;
  name:        string;
  slug:        string;
  parent:      number;
  description: string;
  count:       number;
};

export type WooProduct = {
  id:                 number;
  name:               string;
  slug:               string;
  type:               "simple" | "variable" | "grouped" | "external";
  status:             "publish" | "draft" | "pending" | "private";
  description:        string;
  short_description:  string;
  sku:                string;
  price:              string;
  regular_price:      string;
  sale_price:         string;
  stock_status:       "instock" | "outofstock" | "onbackorder";
  stock_quantity:     number | null;
  manage_stock:       boolean;
  weight:             string;
  categories:         { id: number; name: string; slug: string }[];
  tags:               { id: number; name: string; slug: string }[];
  images:             WooImage[];
  attributes:         { id: number; name: string; options: string[]; variation: boolean }[];
  default_attributes: { id: number; name: string; option: string }[];
  variations:         number[];
  meta_data:          WooMeta[];
  date_created:       string;
};

export type WooVariation = {
  id:             number;
  status:         "publish" | "private" | "draft" | "pending";
  sku:            string;
  price:          string;
  regular_price:  string;
  sale_price:     string;
  stock_status:   "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  manage_stock:   boolean | "parent";
  weight:         string;
  image:          WooImage | null;
  attributes:     { id: number; name: string; option: string }[];
  menu_order:     number;
  meta_data:      WooMeta[];
};
