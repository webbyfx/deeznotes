# 📝 DeezNotes

DeezNotes is a lightweight, web-based note-taking application designed to keep your thoughts organized and accessible. With a clean interface and robust feature set, DeezNotes makes it easy to categorize, pin, and manage your notes beautifully.

## ✨ Features

- **User Authentication**: Secure registration and login to keep your notes private.
- **Rich Text Notes**: Create expressive notes with support for rich text and WYSIWYG editing.
- **Categorization**: Organize your notes into custom categories with personalized colors and emojis.
- **Pin & Archive**: Keep important notes at the top by pinning them, or archive old ones to declutter your workspace.
- **File Uploads**: Seamlessly upload and attach files and images directly to your notes.
- **Responsive Design**: Accessible from both desktop and mobile devices.

## 🛠️ Technology Stack

- **Backend**: Python, Flask, Flask-SQLAlchemy
- **Database**: SQLite
- **Deployment**: Docker, gunicorn

---

## 🚀 Setup & Installation

You can run DeezNotes either locally using Python or via Docker.

### Option A: Running with Docker (Recommended)

The easiest way to get DeezNotes up and running is by using Docker and Docker Compose.

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/yourusername/deeznotes.git
   cd deeznotes
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **Access the app**:
   Open your browser and navigate to `http://localhost:5000`.

*Note: Persistent data (database and uploads) will be stored in Docker volumes automatically.*

### Option B: Running Locally (Python)

If you prefer to run the app natively, follow these steps:

1. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

2. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up the environment variables** (optional but recommended):
   ```bash
   export SECRET_KEY="your-secure-random-string"
   export DATABASE_URL="sqlite:///instance/deeznotes.db"
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```
   *Alternatively, for a production environment, use gunicorn:*
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

5. **Access the app**:
   Open your browser and navigate to `http://localhost:5000`.

---

## 💡 How to Use

1. **Register an Account**: Upon visiting the site, click on "Register" to create a new user account.
2. **Create Categories**: Navigate to your dashboard and create a new category (e.g., "Work", "Personal") and assign it a color and an emoji icon.
3. **Write Notes**: Click "New Note" to start writing. You can categorize your note, pin it for quick access, or even drag and drop images directly into the editor!
4. **Manage Notes**: Use the sidebar to filter notes by category, view archived notes, or search for specific terms.

Enjoy organizing your thoughts with DeezNotes! 🎉
