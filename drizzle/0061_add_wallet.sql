CREATE TABLE `wallet_balance` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wallet_recharges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`out_trade_no` text NOT NULL UNIQUE,
	`provider` text NOT NULL,
	`provider_session_id` text,
	`amount` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wallet_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_before` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`reference_id` text,
	`reference_type` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wallet_records_user_created` ON `wallet_records` (`user_id`, `created_at`);
