CREATE TABLE `alipay_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`out_trade_no` text NOT NULL,
	`alipay_trade_no` text,
	`plan_key` text NOT NULL,
	`interval` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alipay_orders_out_trade_no_unique` ON `alipay_orders` (`out_trade_no`);
