CREATE DATABASE  IF NOT EXISTS `railway` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `railway`;
-- MySQL dump 10.13  Distrib 8.0.45, for macos15 (arm64)
--
-- Host: mainline.proxy.rlwy.net    Database: railway
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Notification`
--

DROP TABLE IF EXISTS `Notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notification` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message` text NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('sent','viewed') DEFAULT 'sent',
  PRIMARY KEY (`notification_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `Notification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `UserCredentials` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notification`
--

LOCK TABLES `Notification` WRITE;
/*!40000 ALTER TABLE `Notification` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Queue`
--

DROP TABLE IF EXISTS `Queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Queue` (
  `queue_id` int NOT NULL AUTO_INCREMENT,
  `service_id` int NOT NULL,
  `status` enum('open','closed') DEFAULT 'open',
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`queue_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `Queue_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `Service` (`service_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Queue`
--

LOCK TABLES `Queue` WRITE;
/*!40000 ALTER TABLE `Queue` DISABLE KEYS */;
INSERT INTO `Queue` VALUES (1,1,'open','2026-04-10 04:00:06'),(2,2,'open','2026-04-10 04:00:08');
/*!40000 ALTER TABLE `Queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `QueueEntry`
--

DROP TABLE IF EXISTS `QueueEntry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `QueueEntry` (
  `entry_id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `position` int NOT NULL,
  `join_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('waiting','served','cancelled') DEFAULT 'waiting',
  `user_name` varchar(100) NOT NULL DEFAULT '',
  `priority` enum('low','medium','high') DEFAULT 'medium',
  `walk_in` tinyint(1) DEFAULT '0',
  `phone` varchar(20) DEFAULT NULL,
  `notes` text,
  `served_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`entry_id`),
  KEY `queue_id` (`queue_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `QueueEntry_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `Queue` (`queue_id`),
  CONSTRAINT `QueueEntry_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `UserCredentials` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `QueueEntry`
--

LOCK TABLES `QueueEntry` WRITE;
/*!40000 ALTER TABLE `QueueEntry` DISABLE KEYS */;
INSERT INTO `QueueEntry` VALUES (1,1,NULL,1,'2026-04-10 04:09:25','cancelled','Mi','low',1,'','');
/*!40000 ALTER TABLE `QueueEntry` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Service`
--

DROP TABLE IF EXISTS `Service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Service` (
  `service_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `expected_duration` int NOT NULL,
  `priority` enum('low','medium','high') DEFAULT 'medium',
  `is_open` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`service_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Service`
--

LOCK TABLES `Service` WRITE;
/*!40000 ALTER TABLE `Service` DISABLE KEYS */;
INSERT INTO `Service` VALUES (1,'Takeaway','Quick pickup',10,'low',0),(2,'Dine-in','Table service',30,'medium',1),(3,'VIP Lounge','Priority seating',20,'high',1),(4,'New Svc','Desc',15,'low',1);
/*!40000 ALTER TABLE `Service` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserCredentials`
--

DROP TABLE IF EXISTS `UserCredentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserCredentials` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserCredentials`
--

LOCK TABLES `UserCredentials` WRITE;
/*!40000 ALTER TABLE `UserCredentials` DISABLE KEYS */;
INSERT INTO `UserCredentials` VALUES (1,'quynhclean@test.com','$2b$10$CzR17TpmNdntmRk5sD7TrOFj9hZZWI/IiCfS6HhHaSMF4EJ6ExQXW','user','2026-04-10 19:54:02'),(2,'quynhtestfinal@test.com','$2b$10$7Z/OGIQhB2I3cK.uJ/W9vuDp5.xYQNlpQKK5eCDUXRm8XbrOw070S','user','2026-04-10 20:19:52'),(3,'admin1@gmail.com','$2b$10$KJIge5VTU6vc590zND6Mn.jjiNi3szlOmkn/1C31FH9SKq6ITTsmm','admin','2026-04-10 20:58:40'),(4,'quynh_1775857849195@gmail.com','$2b$10$vJnIqNdXZCj0C6kYuU7cQ.Jf3tYb8YE4pcfTN/SI1x.tkOEw2nRDC','user','2026-04-10 21:50:50'),(5,'duplicate_1775857850731@gmail.com','$2b$10$tcY34BWV.0jSbmqSmXbaTOrspPq4osX4jFJz6HkQqQfQmAwtgEA6O','user','2026-04-10 21:50:51'),(6,'login_1775857851264@gmail.com','$2b$10$ZCvDmiKu9C3xQTJMXeR/9e9Pzg9nEneCzeGXg7iR9SLaB30DvQQrO','user','2026-04-10 21:50:51'),(7,'wrongpass_1775857852011@gmail.com','$2b$10$QWqWrGSrTDEJiawl3jMazenZZzJa/uy9t2ouPHz8yp4OV0K6ZNZ/6','user','2026-04-10 21:50:52'),(8,'quynh_1775857914050@gmail.com','$2b$10$p7q3yVu6Y3qI5nuJ7cB0Y.srNr2sE5WubbVsr8CSdDsVnHNsBqvKu','user','2026-04-10 21:51:54'),(9,'duplicate_1775857915165@gmail.com','$2b$10$xx1OUPISiMqGagCOhV/iYupjp33Dm63Oo.Z70NIqstuN00vfoYTCy','user','2026-04-10 21:51:55'),(10,'login_1775857915686@gmail.com','$2b$10$50OfwaSMKEbox9MwumHWse3GLrXpi/6nLxUhBV2v306VRQLtLooda','user','2026-04-10 21:51:56'),(11,'wrongpass_1775857916401@gmail.com','$2b$10$ciIKR2KdCqXpWCAZln8qIeKO32MKHAOhu.owuESaEzR2CAJavf1oq','user','2026-04-10 21:51:56'),(12,'quynh_1775858100474@gmail.com','$2b$10$.KMzZPL.dq8MAbKs0J.Y6OEB91nSEhXP3p5ve0reZPNFqTH0hYNj6','user','2026-04-10 21:55:01'),(13,'duplicate_1775858101652@gmail.com','$2b$10$HMvRhWQqgstFUETLW5HPUuD7QjlKZUMcm3VoX7ZWecX26pSOSwps2','user','2026-04-10 21:55:01'),(14,'login_1775858102193@gmail.com','$2b$10$euFVOYa3UUURu2VqzFsogeoIPpOUKnzUPqP/b5tufA.mnEs43zB0q','user','2026-04-10 21:55:02'),(15,'wrongpass_1775858102941@gmail.com','$2b$10$8jEy/BUxlAZV4vuDn/qB/.eGm4m14oiKajWLXb33JHXhYc3Bn21j6','user','2026-04-10 21:55:03'),(16,'andres@gmai.com','$2b$10$K4sD6hvqkgKQBMxjpsbeDu4F/00hql8aHAn6upLnpkIqtthyuOxnS','user','2026-04-10 21:58:18'),(17,'quynh_1775866004849@gmail.com','$2b$10$xQz3aGIynsB2HRkT09WcTOUfffWhoaGlDKyilvOaM.6MY7YbXwLQq','user','2026-04-11 00:06:45'),(18,'duplicate_1775866006264@gmail.com','$2b$10$K/Jtm1KLs4S4ay2g2y3cIe3T2.yC779nOZ65iVZL5kyMZHewVPscq','user','2026-04-11 00:06:46'),(19,'login_1775866006977@gmail.com','$2b$10$MpCOSYdnTK6oj0a0qTGsruxOIJ1IuO5Cv/I6fxFVwy0OxuP5wqyDq','user','2026-04-11 00:06:47'),(20,'wrongpass_1775866008033@gmail.com','$2b$10$qWgxPkw09GQP1OSy5OIPoe.TCBbowyKJfAPO3HFASWzLxf3aS1.zC','user','2026-04-11 00:06:48'),(21,'quynh_1775866136857@gmail.com','$2b$10$q/aOti022ymE85TGT0wzuex5wAL482E9eGB8tMY8p6wFuJDh2sA7O','user','2026-04-11 00:08:57'),(22,'duplicate_1775866138318@gmail.com','$2b$10$YsEFPIHi5nYS.NLnSLpxQeS7O0WCYn.7SdVUqtjRXnxRwO4.RuQfy','user','2026-04-11 00:08:58'),(23,'login_1775866139029@gmail.com','$2b$10$3pnlnJ5RbgRyvvEb02qAI.LCa86TX/nKzrOcSifwBit17GMmbEBBe','user','2026-04-11 00:08:59'),(24,'wrongpass_1775866140083@gmail.com','$2b$10$yIKnicOFMZeJkZ82TjpDh.vxyY7W3odN2e3f.qzfbIJDng3tkOCEm','user','2026-04-11 00:09:00');
/*!40000 ALTER TABLE `UserCredentials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserProfile`
--

DROP TABLE IF EXISTS `UserProfile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserProfile` (
  `profile_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `preferences` text,
  PRIMARY KEY (`profile_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `UserProfile_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `UserCredentials` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserProfile`
--

LOCK TABLES `UserProfile` WRITE;
/*!40000 ALTER TABLE `UserProfile` DISABLE KEYS */;
INSERT INTO `UserProfile` VALUES (1,1,'Quynh Vu','quynhclean@test.com','',NULL),(2,2,'Quynh Test','quynhtestfinal@test.com','8325551234',NULL),(3,3,'Admin 1','admin1@gmail.com','12343212324',NULL),(4,4,'Quynh','quynh_1775857849195@gmail.com','',NULL),(5,5,'Quynh','duplicate_1775857850731@gmail.com','',NULL),(6,6,'Quynh','login_1775857851264@gmail.com','',NULL),(7,7,'Quynh','wrongpass_1775857852011@gmail.com','',NULL),(8,8,'Quynh','quynh_1775857914050@gmail.com','',NULL),(9,9,'Quynh','duplicate_1775857915165@gmail.com','',NULL),(10,10,'Quynh','login_1775857915686@gmail.com','',NULL),(11,11,'Quynh','wrongpass_1775857916401@gmail.com','',NULL),(12,12,'Quynh','quynh_1775858100474@gmail.com','',NULL),(13,13,'Quynh','duplicate_1775858101652@gmail.com','',NULL),(14,14,'Quynh','login_1775858102193@gmail.com','',NULL),(15,15,'Quynh','wrongpass_1775858102941@gmail.com','',NULL),(16,16,'Andres','andres@gmai.com','1234567890',NULL),(17,17,'Quynh','quynh_1775866004849@gmail.com','',NULL),(18,18,'Quynh','duplicate_1775866006264@gmail.com','',NULL),(19,19,'Quynh','login_1775866006977@gmail.com','',NULL),(20,20,'Quynh','wrongpass_1775866008033@gmail.com','',NULL),(21,21,'Quynh','quynh_1775866136857@gmail.com','',NULL),(22,22,'Quynh','duplicate_1775866138318@gmail.com','',NULL),(23,23,'Quynh','login_1775866139029@gmail.com','',NULL),(24,24,'Quynh','wrongpass_1775866140083@gmail.com','',NULL);
/*!40000 ALTER TABLE `UserProfile` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-10 21:03:57
