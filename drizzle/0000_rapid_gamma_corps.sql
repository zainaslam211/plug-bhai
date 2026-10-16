CREATE TABLE IF NOT EXISTS `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coupons` (
	`code` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`minimum` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer DEFAULT 100 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`expires` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT 0 NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "qty_positive" CHECK("order_items"."quantity">0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`access_token` text NOT NULL,
	`customer_id` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'Pending Confirmation' NOT NULL,
	`payment` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`shipping` integer NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`coupon` text,
	`address` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`courier` text DEFAULT '' NOT NULL,
	`tracking` text DEFAULT '' NOT NULL,
	`tracking_url` text DEFAULT '' NOT NULL,
	`cod_collected` integer DEFAULT 0 NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`seo` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `personal` (
	`id` text PRIMARY KEY NOT NULL,
	`cart` text DEFAULT '[]' NOT NULL,
	`wishlist` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`brand` text DEFAULT 'PLUG BHAI' NOT NULL,
	`price` integer NOT NULL,
	`sale` integer,
	`cost` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`threshold` integer DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("products"."stock" >= 0),
	CONSTRAINT "price_nonnegative" CHECK("products"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`rating` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `one_review` ON `reviews` (`product_id`,`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscribers` (
	`email` text PRIMARY KEY NOT NULL,
	`consent` integer NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`order_id` text,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`reminder` text DEFAULT '' NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "variant_stock_nonnegative" CHECK("variants"."stock">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `variants_sku_unique` ON `variants` (`sku`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS single_owner ON staff(role) WHERE role='owner';
