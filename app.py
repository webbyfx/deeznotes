import os
import uuid
from functools import wraps
from datetime import datetime, timezone

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, jsonify, flash, send_from_directory
)
from werkzeug.utils import secure_filename
from config import Config
from models import db, User, Category, Note


def create_app():
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    with app.app_context():
        db.create_all()

    return app


app = create_app()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def login_required(f):
    """Decorator to require login for a route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def current_user():
    """Return the currently logged-in User or None."""
    uid = session.get('user_id')
    if uid:
        return db.session.get(User, uid)
    return None


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('notes_page'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('notes_page'))
        flash('Invalid username or password.', 'error')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        if not username or not password:
            flash('Username and password are required.', 'error')
        elif len(username) < 3:
            flash('Username must be at least 3 characters.', 'error')
        elif len(password) < 4:
            flash('Password must be at least 4 characters.', 'error')
        elif password != confirm:
            flash('Passwords do not match.', 'error')
        elif User.query.filter_by(username=username).first():
            flash('Username already taken.', 'error')
        else:
            user = User(username=username)
            user.set_password(password)
            db.session.add(user)
            db.session.flush()

            # Create a default category for the new user
            default_cat = Category(
                name='General', color='#7c3aed', icon='📝',
                position=0, user_id=user.id
            )
            db.session.add(default_cat)
            db.session.commit()

            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('notes_page'))

    return render_template('register.html')


@app.route('/logout', methods=['POST', 'GET'])
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/notes')
@login_required
def notes_page():
    return render_template('notes.html', username=session.get('username', ''))


# ---------------------------------------------------------------------------
# API — Categories
# ---------------------------------------------------------------------------

@app.route('/api/categories', methods=['GET'])
@login_required
def api_list_categories():
    cats = Category.query.filter_by(user_id=session['user_id']) \
        .order_by(Category.position, Category.id).all()
    return jsonify([c.to_dict() for c in cats])


@app.route('/api/categories', methods=['POST'])
@login_required
def api_create_category():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    max_pos = db.session.query(db.func.max(Category.position)) \
        .filter_by(user_id=session['user_id']).scalar() or 0

    cat = Category(
        name=name,
        color=data.get('color', '#7c3aed'),
        icon=data.get('icon', '📁'),
        position=max_pos + 1,
        user_id=session['user_id'],
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
@login_required
def api_update_category(cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=session['user_id']).first()
    if not cat:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        cat.name = data['name'].strip()
    if 'color' in data:
        cat.color = data['color']
    if 'icon' in data:
        cat.icon = data['icon']
    if 'position' in data:
        cat.position = data['position']
    db.session.commit()
    return jsonify(cat.to_dict())


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def api_delete_category(cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=session['user_id']).first()
    if not cat:
        return jsonify({'error': 'Not found'}), 404
    # Move notes in this category to uncategorized
    Note.query.filter_by(category_id=cat_id, user_id=session['user_id']) \
        .update({'category_id': None})
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/categories/reorder', methods=['PUT'])
@login_required
def api_reorder_categories():
    """Receive an ordered list of category IDs and update positions."""
    data = request.get_json(silent=True) or {}
    order = data.get('order', [])
    for idx, cid in enumerate(order):
        cat = Category.query.filter_by(id=cid, user_id=session['user_id']).first()
        if cat:
            cat.position = idx
    db.session.commit()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# API — Notes
# ---------------------------------------------------------------------------

@app.route('/api/notes', methods=['GET'])
@login_required
def api_list_notes():
    q = Note.query.filter_by(user_id=session['user_id'])

    # Filter by category
    cat_id = request.args.get('category_id')
    if cat_id == 'uncategorized':
        q = q.filter(Note.category_id.is_(None))
    elif cat_id == 'archived':
        q = q.filter_by(is_archived=True)
    elif cat_id and cat_id != 'all':
        q = q.filter_by(category_id=int(cat_id), is_archived=False)
    else:
        q = q.filter_by(is_archived=False)

    # Search
    search = request.args.get('q', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Note.title.ilike(like), Note.content.ilike(like)))

    # Order: pinned first, then by updated_at desc
    notes = q.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()
    return jsonify([n.to_dict() for n in notes])


@app.route('/api/notes/<int:note_id>', methods=['GET'])
@login_required
def api_get_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=session['user_id']).first()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(note.to_dict())


@app.route('/api/notes', methods=['POST'])
@login_required
def api_create_note():
    data = request.get_json(silent=True) or {}
    note = Note(
        title=data.get('title', 'Untitled Note').strip() or 'Untitled Note',
        content=data.get('content', ''),
        category_id=data.get('category_id'),
        user_id=session['user_id'],
        is_pinned=data.get('is_pinned', False),
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@login_required
def api_update_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=session['user_id']).first()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json(silent=True) or {}
    if 'title' in data:
        note.title = data['title'].strip() or 'Untitled Note'
    if 'content' in data:
        note.content = data['content']
    if 'category_id' in data:
        note.category_id = data['category_id']
    if 'is_pinned' in data:
        note.is_pinned = data['is_pinned']
    if 'is_archived' in data:
        note.is_archived = data['is_archived']
    note.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(note.to_dict())


@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
@login_required
def api_delete_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=session['user_id']).first()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# API — File upload (image paste)
# ---------------------------------------------------------------------------

def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


@app.route('/api/upload', methods=['POST'])
@login_required
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(f.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    original_name = secure_filename(f.filename) or 'unnamed'
    ext = f.filename.rsplit('.', 1)[1].lower()
    filename = f'{uuid.uuid4().hex}.{ext}'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    f.save(filepath)

    file_size = os.path.getsize(filepath)
    url = url_for('static', filename=f'uploads/{filename}')
    return jsonify({
        'url': url,
        'original_name': original_name,
        'size': file_size,
    }), 201


@app.route('/api/download/<path:filename>')
@login_required
def api_download(filename):
    """Serve an uploaded file as a download with its original name."""
    original_name = request.args.get('name', filename)
    return send_from_directory(
        app.config['UPLOAD_FOLDER'], filename,
        as_attachment=True,
        download_name=original_name,
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
