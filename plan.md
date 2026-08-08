# Project Plan: DeezNotes - Python web based notes taking app 

## Objective:
Design and build a Python-based web application called "DeezNotes" for notes

## Scope:
1. Simple basic user account 
2. Note Management: Create, read, update, and delete notes within the web app
3. Mobile Responsive: The app should be responsive and work on mobile devices

## Tech Stack:
1. Python
2. Flask
3. SQLite
4. Dockerfile
5. Docker supported

## Navigation
Side panel for note categories, a "+" button for creating new note categories, a search bar for searching notes.

## Features
1. User Login
2. Note Creation
3. Note Editing
4. Note Deletion
5. Note Listing
6. Note Detail View

## UI / UX:
- Clean, modern, and responsive design
- Mobile-first approach
- Click anywhere in the middle of the page to start typing a note
- Pate anywhere to create a new note with anything in the clipboard.
- Image paste support
- Code block support
- Very similar to OneNote but with a better UI/UX. And only 1 navigation of categories.
- WYSIWYG editor, which stands for "What You See Is What You Get"
- Instant save to database.
- Font support
- table support
- link support
- bullet and numbering support

## API Endpoints
POST /login
POST /logout
GET /notes
GET /notes/:id
POST /notes
PUT /notes/:id
DELETE /notes/:id
