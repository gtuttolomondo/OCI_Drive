# ☁️ OCI Drive - Secure Object Storage Manager

**OCI Drive** is a modern and intuitive web application designed to manage your files on **Oracle Cloud Infrastructure (OCI) Object Storage** with a user experience similar to Google Drive. It includes advanced multi-cloud synchronization and rapid file transfer features.

![OCI Drive Favicon](static/images/oci_drive_02ß.png)

## 🚀 Key Features

### 1. Intuitive File Management
- **File Explorer:** Navigate through files and folders in your OCI bucket.
- **Upload & Download:** Upload files via drag-and-drop and download them with a single click.
- **Integrated Preview:** View PDFs, images, text files, and Word documents (`.docx`) directly in your browser.
- **Organization:** Create, rename, and delete folders and files in real-time.

### 2. WeTransfer-Style (File Transfer) 🔗
Securely share files with anyone using temporary links:
- **Dedicated Folder:** A "File Transfer" section to manage shared files.
- **Pre-Authenticated Requests (PAR):** Generate public links that do not require login.
- **Custom Expiration:** Set link validity (1 hour, 24 hours, 7 days, or 30 days).
- **Link History:** View active links and their expiration dates by clicking the chain icon.

### 3. Google Drive Sync 🔄
Intelligent multi-cloud synchronization:
- **Cloud-to-Cloud Copy:** Import entire folders or individual files from Google Drive directly to OCI.
- **Automatic Sanitization:** Formats filenames to be compatible with OCI Object Storage standards.
- **Real-Time Logging:** Monitor the copy process with indicators for skipped or existing files.

### 4. Offline Websites 🌐
Capture and archive complete websites:
- Save static web pages directly into your bucket.
- Ideal for archiving documentation or important references for offline consultation.

## 🛠️ Architecture and Logic

The app is built with a **Full-Stack Light** approach:
- **Backend:** Flask (Python) communicating with Oracle Cloud APIs via the official SDK (`oci`).
- **Frontend:** Modern interface with **Glassmorphism** aesthetics, built using Vanilla JS, HTML5, and CSS3.
- **Storage:** Leverages OCI Object Storage for unlimited scalability and low costs.
- **Security:** Google OAuth2 authentication for sync and secure management of OCI credentials via protected configuration files.

## ⚙️ Requirements and Installation

### 1. Prerequisites
- Python 3.10+
- An Oracle Cloud account with a created Bucket.
- Google API Credentials (for synchronization).

### 2. `.env` Configuration
Create a `.env` file in the project root with the following details:
```env
OCI_CONFIG_FILE=~/.oci/config
OCI_CONFIG_PROFILE_NAME=DEFAULT
OCI_NAMESPACE=your_namespace
OCI_BUCKET_NAME=oci-drive
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxx

FLASK_SECRET_KEY=a_very_long_secret_key

GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5001/api/gdrive/callback
```

### 3. Running the App
```bash
pip install -r requirements.txt
python app.py
```
The app will be available at `http://127.0.0.1:5001`.

## 📁 Project Structure
- `app.py`: Entry point and API routes.
- `oci_client.py`: Logic wrapper for all Oracle Cloud operations.
- `static/js/main.js`: UI logic and asynchronous interactions.
- `static/css/style.css`: Design system (Glassmorphism).
- `templates/index.html`: Single Page Application structure.

---
*Designed to be fast, secure, and scalable.* 🚀
