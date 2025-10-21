<?php
// db_connect.php
$servername = "sql313.infinityfree.com"; // Or your database host
$username = "if0_40007231";
$password = "Pomar021505";
$dbname = "if0_40007231_wifispot_payments";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}
?>