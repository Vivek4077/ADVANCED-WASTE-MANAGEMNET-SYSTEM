Advanced Waste Management Dashboard
This project is a comprehensive, real-time dashboard for monitoring and analyzing an automated waste sorting facility. It's built with modern web technologies and provides a detailed simulation of the sorting process, from initial sensor checks to final classification and logging.

The dashboard offers a clean, responsive, and user-friendly interface with both light and dark modes, making it suitable for various operational environments.

Live Demo
[Link to your live demo hosted on GitHub Pages or another service would go here.]

Features
Real-time Monitoring: The dashboard connects to a Firebase Firestore database to display live data as waste items are processed, ensuring all analytics are up-to-the-second.

Advanced Two-Stage Simulation: The system simulates a sophisticated sorting process:

IR Sensor: Performs an initial pre-sort into "Organic" or "Inorganic" categories.

ML Classification: A simulated camera and machine learning model identifies the specific material type (e.g., Plastic, Metal, Glass) and provides a confidence score.

Interactive Data Visualization: Utilizes Chart.js to display key performance indicators through a variety of charts:

Waste Category Breakdown: (Recycled, Dumped, Special Handling)

Recycled vs. Non-Recycled: A high-level overview of sorting efficiency.

Recycled Material Types: A detailed bar chart of all recycled materials.

Processing Trend: A line chart showing throughput over time.

Dynamic Filtering: Users can filter all analytics data by various time ranges (5 Mins, 1 Hr, 12 Hr, 1 Day, All Time) to identify trends.

System Controls & Feedback:

Live Controls: Start and pause the conveyor belt simulation.

Fault Simulation: A button to simulate a system fault (e.g., "Camera Obstructed") to demonstrate error logging.

Visual Feedback: An animated conveyor belt shows items moving through each checkpoint, with lights indicating the successfully sorted material.

Modern UI/UX:

Responsive Design: The UI is fully responsive and works seamlessly on desktops, tablets, and mobile devices.

Light & Dark Mode: Includes a theme toggler that respects user's system preference and saves their choice.

Tech Stack
This project uses a modern, serverless architecture.

Frontend:

HTML5

CSS3 (with custom properties for theming)

JavaScript (ES6 Modules)

Styling:

Tailwind CSS: A utility-first CSS framework for rapid UI development.

Data Visualization:

Chart.js: For creating interactive and responsive charts.

Backend & Database (Serverless):

Firebase Firestore: A NoSQL cloud database for storing and syncing data in real-time.

Firebase Authentication: Used for secure, anonymous user sign-in to manage database permissions.

Notifications:

Toastify.js: For displaying simple, non-intrusive notifications.

How to Run This Project Locally
To run this dashboard on your own machine, follow these steps:

Prerequisites
You need Git to clone the repository.

You need a simple local server to run the project. The easiest way is to use the Live Server extension in Visual Studio Code or by running a simple Python server.

1. Clone the Repository
Open your terminal and run the following command:

git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name

2. Set up Firebase
Create a new project on the Firebase Console.

In your new project, go to the "Build" section and create a Firestore Database. Start it in test mode for this demo.

Go to your Project Settings > General. Under "Your apps", create a new Web app.

Firebase will provide you with a firebaseConfig object. You will need this for the next step.

3. Configure the Project
This project is designed to work in an environment where Firebase configuration variables are provided. To run it standalone, you would need to modify the script.js file to use your own config. (Note: In a production app, these keys should be stored securely and not hard-coded).

4. Run the Local Server
Option A: Using Visual Studio Code & Live Server

Install the Live Server extension from the VS Code Marketplace.

Open the project folder in VS Code.

Click the "Go Live" button in the bottom-right corner of the editor.

Option B: Using Python

Open a terminal in the project's root folder.

Run one of the following commands:

# For Python 3
python -m http.server

# For Python 2
python -m SimpleHTTPServer

Open your browser and go to http://localhost:8000.