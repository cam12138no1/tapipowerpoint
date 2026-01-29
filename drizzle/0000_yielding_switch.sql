CREATE TABLE IF NOT EXISTS `pptTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`manusTaskId` varchar(128),
	`status` enum('pending','uploading','running','ask','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStep` text,
	`progress` int NOT NULL DEFAULT 0,
	`sourceFileName` varchar(255),
	`sourceFileId` varchar(128),
	`sourceFileUrl` text,
	`imageAttachments` text,
	`interactionData` text,
	`resultPptxUrl` text,
	`resultPdfUrl` text,
	`resultFileKey` varchar(255),
	`errorMessage` text,
	`timelineEvents` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pptTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`manusProjectId` varchar(128),
	`designSpec` text,
	`primaryColor` varchar(32) NOT NULL DEFAULT '#0c87eb',
	`secondaryColor` varchar(32) NOT NULL DEFAULT '#737373',
	`accentColor` varchar(32) NOT NULL DEFAULT '#10b981',
	`fontFamily` varchar(128) NOT NULL DEFAULT '微软雅黑',
	`logoUrl` text,
	`logoFileKey` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
