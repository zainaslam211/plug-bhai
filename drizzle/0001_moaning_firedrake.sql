CREATE TABLE `operation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "guard_must_pass" CHECK("operation_guards"."ok"=1)
);
