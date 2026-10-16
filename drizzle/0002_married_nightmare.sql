CREATE TABLE `supplier_enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`company` text NOT NULL,
	`contact` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`city` text NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`catalog` text DEFAULT '' NOT NULL,
	`products` text NOT NULL,
	`commission_type` text NOT NULL,
	`commission_value` integer,
	`fulfillment` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_enquiries_request_key_unique` ON `supplier_enquiries` (`request_key`);