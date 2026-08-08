/* ====================================================================
   DeezNotes — Frontend Application Logic
   ==================================================================== */

(function () {
    'use strict';

    // ===== State =====
    const state = {
        categories: [],
        notes: [],
        activeFilter: 'all',          // 'all' | 'uncategorized' | 'archived' | category id
        activeNoteId: null,
        editingCategoryId: null,       // for edit modal
        saveTimer: null,
        quill: null,
        isDirty: false,
    };

    // ===== DOM References =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        sidebar: $('#sidebar'),
        sidebarToggle: $('#sidebar-toggle'),
        sidebarClose: $('#sidebar-close'),
        searchInput: $('#search-input'),
        categoriesList: $('#categories-list'),
        addCategoryBtn: $('#add-category-btn'),
        noteList: $('#note-list'),
        noteListEmpty: $('#note-list-empty'),
        noteListPanel: $('#note-list-panel'),
        noteListTitle: $('#note-list-title'),
        editorPanel: $('#editor-panel'),
        editorTitle: $('#editor-title'),
        editorDate: $('#editor-date'),
        editorWordcount: $('#editor-wordcount'),
        editorSaveStatus: $('#editor-save-status'),
        mainContent: $('#main-content'),
        newNoteBtn: $('#new-note-btn'),
        newNoteBtnMobile: $('#new-note-btn-mobile'),
        editorBack: $('#editor-back'),
        btnPin: $('#btn-pin'),
        btnArchive: $('#btn-archive'),
        btnDeleteNote: $('#btn-delete-note'),
        themeToggle: $('#theme-toggle'),
        topbarTitle: $('#topbar-title'),
        // Category modal
        categoryModal: $('#category-modal'),
        categoryModalTitle: $('#category-modal-title'),
        catNameInput: $('#cat-name-input'),
        categoryModalCancel: $('#category-modal-cancel'),
        categoryModalSave: $('#category-modal-save'),
        // Confirm dialog
        confirmOverlay: $('#confirm-overlay'),
        confirmMessage: $('#confirm-message'),
        confirmCancel: $('#confirm-cancel'),
        confirmOk: $('#confirm-ok'),
        // Toast
        toastContainer: $('#toast-container'),
    };


    // ===== Utilities =====

    function api(url, opts = {}) {
        const defaults = {
            headers: { 'Content-Type': 'application/json' },
        };
        if (opts.body && typeof opts.body === 'object') {
            opts.body = JSON.stringify(opts.body);
        }
        return fetch(url, { ...defaults, ...opts }).then(async (r) => {
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Request failed');
            return data;
        });
    }

    function toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        dom.toastContainer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    function timeAgo(isoStr) {
        if (!isoStr) return '';
        const diff = Date.now() - new Date(isoStr + 'Z').getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(isoStr + 'Z').toLocaleDateString();
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return tmp.textContent || tmp.innerText || '';
    }

    function wordCount(html) {
        const text = stripHtml(html).trim();
        if (!text) return 0;
        return text.split(/\s+/).length;
    }

    let confirmResolve = null;
    function confirmDialog(message) {
        return new Promise((resolve) => {
            confirmResolve = resolve;
            dom.confirmMessage.textContent = message;
            dom.confirmOverlay.classList.add('show');
        });
    }


    // ===== Theme =====

    function initTheme() {
        const saved = localStorage.getItem('deeznotes-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('deeznotes-theme', next);
        updateThemeIcon(next);
    }

    function updateThemeIcon(theme) {
        dom.themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
    }


    // ===== Categories =====

    async function loadCategories() {
        state.categories = await api('/api/categories');
        renderCategories();
    }

    function renderCategories() {
        dom.categoriesList.innerHTML = '';
        state.categories.forEach((cat) => {
            const group = document.createElement('div');
            group.className = 'sidebar-group collapsed';
            group.dataset.categoryId = cat.id;
            
            const el = document.createElement('div');
            el.className = 'sidebar-item';
            el.innerHTML = `
                <div class="sidebar-item-content">
                    <span class="sidebar-item-icon" style="color:${cat.color}">${cat.icon}</span>
                    <span class="sidebar-item-text">${escHtml(cat.name)}</span>
                </div>
                <span class="sidebar-item-actions">
                    <button class="btn-icon new-note-btn" data-category="${cat.id}" title="New Note">＋</button>
                    <div class="dropdown">
                        <button class="btn-icon dropdown-toggle" title="Menu">⋮</button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item cat-edit-btn" data-id="${cat.id}">✏️ Edit</button>
                            <button class="dropdown-item cat-delete-btn" data-id="${cat.id}">🗑️ Delete</button>
                        </div>
                    </div>
                </span>
            `;
            group.appendChild(el);
            
            const notesContainer = document.createElement('div');
            notesContainer.className = 'sidebar-notes-container';
            notesContainer.id = `notes-category-${cat.id}`;
            group.appendChild(notesContainer);
            
            dom.categoriesList.appendChild(group);

            el.addEventListener('click', (e) => {
                if (e.target.closest('.dropdown') || e.target.closest('.new-note-btn')) return;
                group.classList.toggle('collapsed');
            });
            
            // Dropdown toggle logic
            const dropdownToggle = el.querySelector('.dropdown-toggle');
            dropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                document.querySelectorAll('.dropdown.show').forEach(d => {
                    if (d !== dropdownToggle.parentElement) d.classList.remove('show');
                });
                dropdownToggle.parentElement.classList.toggle('show');
            });
        });

        dom.categoriesList.querySelectorAll('.cat-edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cat = state.categories.find((c) => c.id == btn.dataset.id);
                if (cat) openCategoryModal(cat);
            });
        });
        dom.categoriesList.querySelectorAll('.cat-delete-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = await confirmDialog('Delete this category? Notes will be moved to Uncategorized.');
                if (ok) {
                    await api(`/api/categories/${btn.dataset.id}`, { method: 'DELETE' });
                    toast('Category deleted', 'success');
                    await loadCategories();
                    await loadNotes();
                }
            });
        });
        dom.categoriesList.querySelectorAll('.new-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                createNote(btn.dataset.category);
            });
        });

        if (window.Sortable) {
            Sortable.create(dom.categoriesList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                handle: '.sidebar-item-content',
                onEnd: async () => {
                    const order = Array.from(dom.categoriesList.children).map(
                        (el) => parseInt(el.dataset.categoryId)
                    );
                    await api('/api/categories/reorder', { method: 'PUT', body: { order } });
                },
            });
        }
    }

    function escHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // Category modal
    function openCategoryModal(cat = null) {
        state.editingCategoryId = cat ? cat.id : null;
        dom.categoryModalTitle.textContent = cat ? 'Edit Category' : 'New Category';
        dom.catNameInput.value = cat ? cat.name : '';

        // Reset selections
        $$('.emoji-option').forEach((e) => e.classList.remove('selected'));
        $$('.color-option').forEach((e) => e.classList.remove('selected'));

        const selEmoji = cat ? cat.icon : '📁';
        const selColor = cat ? cat.color : '#7c3aed';
        const emojiEl = $(`.emoji-option[data-emoji="${selEmoji}"]`);
        if (emojiEl) emojiEl.classList.add('selected');
        const colorEl = $(`.color-option[data-color="${selColor}"]`);
        if (colorEl) colorEl.classList.add('selected');

        dom.categoryModal.classList.add('show');
        dom.catNameInput.focus();
    }

    async function saveCategoryModal() {
        const name = dom.catNameInput.value.trim();
        if (!name) { toast('Name is required', 'error'); return; }

        const icon = $('.emoji-option.selected')?.dataset.emoji || '📁';
        const color = $('.color-option.selected')?.dataset.color || '#7c3aed';

        if (state.editingCategoryId) {
            await api(`/api/categories/${state.editingCategoryId}`, {
                method: 'PUT', body: { name, icon, color },
            });
            toast('Category updated', 'success');
        } else {
            await api('/api/categories', {
                method: 'POST', body: { name, icon, color },
            });
            toast('Category created', 'success');
        }

        dom.categoryModal.classList.remove('show');
        await loadCategories();
    }


    // ===== Notes =====

    async function loadNotes() {
        const search = dom.searchInput.value.trim();
        const params = new URLSearchParams();
        if (search) params.set('q', search);

        state.notes = await api(`/api/notes?${params}`);
        renderNotes();
    }

    function renderNoteItem(note) {
        const el = document.createElement('div');
        el.className = 'sidebar-note' + (note.id === state.activeNoteId ? ' active' : '');
        el.dataset.id = note.id;
        el.innerHTML = `
            ${note.is_pinned ? '<span class="sidebar-note-pin">📌</span>' : ''}
            <div class="sidebar-note-title">${escHtml(note.title)}</div>
            <div class="sidebar-note-date">${timeAgo(note.updated_at)}</div>
        `;
        el.addEventListener('click', () => openNote(note.id));
        return el;
    }

    function renderNotes() {
        const containers = document.querySelectorAll('.sidebar-notes-container');
        containers.forEach(c => c.innerHTML = '');
        
        let allCount = 0;
        let uncategorizedCount = 0;
        let archivedCount = 0;
        const catCounts = {};

        state.notes.forEach((note) => {
            const el = renderNoteItem(note);
            const elAll = renderNoteItem(note);

            const allNotesContainer = document.getElementById('notes-all');
            if (allNotesContainer) allNotesContainer.appendChild(elAll);
            allCount++;

            if (note.is_archived) {
                const archivedContainer = document.getElementById('notes-archived');
                if (archivedContainer) archivedContainer.appendChild(el);
                archivedCount++;
            } else if (note.category_id) {
                const catContainer = document.getElementById(`notes-category-${note.category_id}`);
                if (catContainer) {
                    catContainer.appendChild(el);
                    catCounts[note.category_id] = (catCounts[note.category_id] || 0) + 1;
                } else {
                    const uncategorizedContainer = document.getElementById('notes-uncategorized');
                    if (uncategorizedContainer) uncategorizedContainer.appendChild(el);
                    uncategorizedCount++;
                }
            } else {
                const uncategorizedContainer = document.getElementById('notes-uncategorized');
                if (uncategorizedContainer) uncategorizedContainer.appendChild(el);
                uncategorizedCount++;
            }
        });

        // Removed counts update
    }

    async function openNote(noteId) {
        // Save current note first if dirty
        if (state.isDirty && state.activeNoteId) {
            await saveCurrentNote();
        }

        state.activeNoteId = noteId;
        const note = await api(`/api/notes/${noteId}`);

        dom.editorTitle.value = note.title === 'Untitled Note' ? '' : note.title;
        state.quill.root.innerHTML = note.content || '';
        dom.editorDate.textContent = timeAgo(note.updated_at);
        dom.editorWordcount.textContent = wordCount(note.content) + ' words';
        updateSaveStatus('saved');

        // Pin button state
        dom.btnPin.style.opacity = note.is_pinned ? '1' : '0.5';
        dom.btnArchive.style.opacity = note.is_archived ? '1' : '0.5';

        // Show editor
        dom.editorPanel.style.display = 'flex';
        dom.mainContent.classList.add('editor-active');

        // Mark active in list
        $$('.sidebar-note').forEach((c) => c.classList.toggle('active', c.dataset.id == noteId));

        state.isDirty = false;
    }

    async function createNote(categoryId = null) {
        const body = { title: 'Untitled Note', content: '' };
        if (categoryId && categoryId !== 'null') {
            body.category_id = parseInt(categoryId);
        }
        const note = await api('/api/notes', { method: 'POST', body });
        toast('Note created', 'success');

        if (categoryId && categoryId !== 'null') {
            const group = document.querySelector(`.sidebar-group[data-category-id="${categoryId}"]`);
            if (group && group.classList.contains('collapsed')) {
                group.classList.remove('collapsed');
            }
        } else if (!categoryId || categoryId === 'null') {
             const group = document.getElementById('filter-uncategorized').closest('.sidebar-group');
             if (group && group.classList.contains('collapsed')) {
                 group.classList.remove('collapsed');
             }
        }

        await loadNotes();
        openNote(note.id);
    }

    async function saveCurrentNote() {
        if (!state.activeNoteId) return;
        const title = dom.editorTitle.value.trim() || 'Untitled Note';
        const content = state.quill.root.innerHTML;

        updateSaveStatus('saving');
        try {
            await api(`/api/notes/${state.activeNoteId}`, {
                method: 'PUT',
                body: { title, content },
            });
            updateSaveStatus('saved');
            state.isDirty = false;

            // Update note in state for the list
            const idx = state.notes.findIndex((n) => n.id === state.activeNoteId);
            if (idx >= 0) {
                state.notes[idx].title = title;
                state.notes[idx].content = content;
                state.notes[idx].updated_at = new Date().toISOString();
            }
            renderNotes();
        } catch (e) {
            updateSaveStatus('error');
            toast('Failed to save note', 'error');
        }
    }

    function scheduleSave() {
        state.isDirty = true;
        updateSaveStatus('saving');
        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(() => saveCurrentNote(), 800);
    }

    function updateSaveStatus(status) {
        dom.editorSaveStatus.className = 'editor-save-status ' + status;
        dom.editorSaveStatus.textContent =
            status === 'saving' ? 'Saving…' :
            status === 'saved' ? 'Saved' :
            'Error';
    }

    async function deleteCurrentNote() {
        if (!state.activeNoteId) return;
        const ok = await confirmDialog('Delete this note permanently?');
        if (!ok) return;
        await api(`/api/notes/${state.activeNoteId}`, { method: 'DELETE' });
        toast('Note deleted', 'success');
        closeEditor();
        await loadNotes();
        await loadCategories();
    }

    async function togglePin() {
        if (!state.activeNoteId) return;
        const note = state.notes.find((n) => n.id === state.activeNoteId);
        if (!note) return;
        const newVal = !note.is_pinned;
        await api(`/api/notes/${state.activeNoteId}`, {
            method: 'PUT', body: { is_pinned: newVal },
        });
        note.is_pinned = newVal;
        dom.btnPin.style.opacity = newVal ? '1' : '0.5';
        toast(newVal ? 'Note pinned' : 'Note unpinned', 'success');
        await loadNotes();
    }

    async function toggleArchive() {
        if (!state.activeNoteId) return;
        const note = state.notes.find((n) => n.id === state.activeNoteId);
        if (!note) return;
        const newVal = !note.is_archived;
        await api(`/api/notes/${state.activeNoteId}`, {
            method: 'PUT', body: { is_archived: newVal },
        });
        toast(newVal ? 'Note archived' : 'Note restored', 'success');
        closeEditor();
        await loadNotes();
        await loadCategories();
    }

    function closeEditor() {
        state.activeNoteId = null;
        dom.editorPanel.style.display = 'none';
        dom.mainContent.classList.remove('editor-active');
        $$('.sidebar-note').forEach((c) => c.classList.remove('active'));
    }

    // ===== Sidebar Toggle =====

    function openSidebar() {
        dom.sidebar.classList.add('open');
        let overlay = $('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay show';
            overlay.addEventListener('click', closeSidebar);
            document.body.appendChild(overlay);
        } else {
            overlay.classList.add('show');
        }
    }

    function closeSidebar() {
        dom.sidebar.classList.remove('open');
        const overlay = $('.sidebar-overlay');
        if (overlay) overlay.classList.remove('show');
    }


    // ===== Initialize Quill Editor =====

    function initQuill() {
        state.quill = new Quill('#quill-editor', {
            theme: 'snow',
            placeholder: 'Start writing your note…',
            modules: {
                syntax: {
                    hljs: window.hljs,
                    languages: [
                        { key: 'bash', label: 'Bash / Shell' },
                        { key: 'c', label: 'C' },
                        { key: 'cpp', label: 'C++' },
                        { key: 'csharp', label: 'C#' },
                        { key: 'css', label: 'CSS' },
                        { key: 'diff', label: 'Diff' },
                        { key: 'dockerfile', label: 'Dockerfile' },
                        { key: 'go', label: 'Go' },
                        { key: 'html', label: 'HTML/XML' },
                        { key: 'java', label: 'Java' },
                        { key: 'javascript', label: 'JavaScript' },
                        { key: 'json', label: 'JSON' },
                        { key: 'kotlin', label: 'Kotlin' },
                        { key: 'lua', label: 'Lua' },
                        { key: 'markdown', label: 'Markdown' },
                        { key: 'php', label: 'PHP' },
                        { key: 'plaintext', label: 'Plain Text' },
                        { key: 'powershell', label: 'PowerShell' },
                        { key: 'python', label: 'Python' },
                        { key: 'ruby', label: 'Ruby' },
                        { key: 'rust', label: 'Rust' },
                        { key: 'sql', label: 'SQL' },
                        { key: 'swift', label: 'Swift' },
                        { key: 'typescript', label: 'TypeScript' },
                        { key: 'yaml', label: 'YAML' }
                    ]
                },
                toolbar: {
                    container: [
                        [{ header: [1, 2, 3, false] }],
                        [{ font: [] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ color: [] }, { background: [] }],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['blockquote', 'code-block'],
                        ['link', 'image'],
                        [{ align: [] }],
                        ['clean'],
                    ],
                    handlers: {
                        // Override toolbar image button to use our upload flow
                        image: function () {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.addEventListener('change', () => {
                                if (input.files && input.files[0]) {
                                    uploadImage(input.files[0]);
                                }
                            });
                            input.click();
                        },
                    },
                },
            },
        });

        // Auto-save on text change
        state.quill.on('text-change', () => {
            if (state.activeNoteId) {
                dom.editorWordcount.textContent = wordCount(state.quill.root.innerHTML) + ' words';
                scheduleSave();
            }
        });

        // ── Image paste handler (FIXED: capture phase + stopImmediatePropagation) ──
        // The bug: Quill's clipboard module has its own paste listener on the same
        // element. Our old handler called preventDefault() which stops the browser,
        // but Quill's internal handler still fires and inserts a base64 duplicate.
        // Fix: register on the parent container in CAPTURE phase so we fire first,
        // then stopImmediatePropagation to block Quill's handler entirely for images.
        const qlContainer = state.quill.root.parentElement;
        qlContainer.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            let hasImage = false;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    hasImage = true;
                    const file = item.getAsFile();
                    if (file) uploadImage(file);
                    break;
                }
            }

            if (hasImage) {
                e.stopImmediatePropagation(); // prevent Quill's clipboard handler
                e.preventDefault();            // prevent browser default
            }
            // If no image, let Quill handle the paste normally (text, HTML, etc.)
        }, true); // ← capture phase: fires BEFORE Quill's bubble-phase listener

        // ── Image resize & reposition system ──
        initImageResize();
    }

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('file', file, file.name || 'pasted-image.png');
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                const range = state.quill.getSelection(true);
                state.quill.insertEmbed(range.index, 'image', data.url);
                state.quill.setSelection(range.index + 1);
                toast('Image uploaded', 'success');
            }
        } catch {
            toast('Image upload failed', 'error');
        }
    }



    // ===== Image Resize & Reposition =====

    function initImageResize() {
        let overlay = null;       // the resize overlay element
        let activeImg = null;     // the currently selected <img>
        let startX, startY, startW, startH, aspectRatio;
        let resizing = false;

        // Create overlay (shown over selected image)
        function createOverlay() {
            overlay = document.createElement('div');
            overlay.className = 'img-resize-overlay';
            overlay.innerHTML = `
                <div class="img-resize-handle" data-dir="nw"></div>
                <div class="img-resize-handle" data-dir="ne"></div>
                <div class="img-resize-handle" data-dir="sw"></div>
                <div class="img-resize-handle" data-dir="se"></div>
                <div class="img-resize-toolbar">
                    <button class="img-tb-btn" data-action="align-left" title="Float left">◧</button>
                    <button class="img-tb-btn" data-action="align-center" title="Center">◫</button>
                    <button class="img-tb-btn" data-action="align-right" title="Float right">◨</button>
                    <button class="img-tb-btn" data-action="full-width" title="Full width">⬛</button>
                    <span class="img-tb-sep"></span>
                    <button class="img-tb-btn" data-action="size-small" title="Small (25%)">S</button>
                    <button class="img-tb-btn" data-action="size-medium" title="Medium (50%)">M</button>
                    <button class="img-tb-btn" data-action="size-large" title="Large (75%)">L</button>
                    <button class="img-tb-btn" data-action="size-original" title="Original size">1:1</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // Handle resize drag
            overlay.querySelectorAll('.img-resize-handle').forEach((handle) => {
                handle.addEventListener('mousedown', onResizeStart);
                handle.addEventListener('touchstart', onResizeStart, { passive: false });
            });

            // Handle toolbar buttons
            overlay.querySelectorAll('.img-tb-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleImageAction(btn.dataset.action);
                });
            });
        }

        function selectImage(img) {
            if (activeImg === img) return;
            deselectImage();
            activeImg = img;
            if (!overlay) createOverlay();
            positionOverlay();
            overlay.classList.add('visible');
            activeImg.classList.add('img-selected');
        }

        function deselectImage() {
            if (activeImg) {
                activeImg.classList.remove('img-selected');
                activeImg = null;
            }
            if (overlay) overlay.classList.remove('visible');
        }

        function positionOverlay() {
            if (!activeImg || !overlay) return;
            const rect = activeImg.getBoundingClientRect();
            overlay.style.left = rect.left + window.scrollX + 'px';
            overlay.style.top = rect.top + window.scrollY + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
        }

        // ── Resize drag ──

        function onResizeStart(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!activeImg) return;
            resizing = true;

            const rect = activeImg.getBoundingClientRect();
            startW = rect.width;
            startH = rect.height;
            aspectRatio = startW / startH;

            const point = e.touches ? e.touches[0] : e;
            startX = point.clientX;
            startY = point.clientY;

            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeEnd);
            document.addEventListener('touchmove', onResizeMove, { passive: false });
            document.addEventListener('touchend', onResizeEnd);
        }

        function onResizeMove(e) {
            if (!resizing || !activeImg) return;
            e.preventDefault();

            const point = e.touches ? e.touches[0] : e;
            const dx = point.clientX - startX;
            const dy = point.clientY - startY;

            // Use the larger delta to maintain aspect ratio
            let newW = Math.max(60, startW + dx);
            let newH = newW / aspectRatio;

            activeImg.style.width = Math.round(newW) + 'px';
            activeImg.style.height = Math.round(newH) + 'px';
            positionOverlay();
        }

        function onResizeEnd() {
            resizing = false;
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeEnd);
            document.removeEventListener('touchmove', onResizeMove);
            document.removeEventListener('touchend', onResizeEnd);

            if (activeImg) {
                positionOverlay();
                scheduleSave(); // persist the new size
            }
        }

        // ── Toolbar actions ──

        function handleImageAction(action) {
            if (!activeImg) return;

            // Remove all alignment classes first
            activeImg.classList.remove('img-align-left', 'img-align-center', 'img-align-right', 'img-full-width');

            switch (action) {
                case 'align-left':
                    activeImg.classList.add('img-align-left');
                    break;
                case 'align-center':
                    activeImg.classList.add('img-align-center');
                    break;
                case 'align-right':
                    activeImg.classList.add('img-align-right');
                    break;
                case 'full-width':
                    activeImg.classList.add('img-full-width');
                    activeImg.style.width = '';
                    activeImg.style.height = '';
                    break;
                case 'size-small':
                    activeImg.style.width = '25%';
                    activeImg.style.height = 'auto';
                    break;
                case 'size-medium':
                    activeImg.style.width = '50%';
                    activeImg.style.height = 'auto';
                    break;
                case 'size-large':
                    activeImg.style.width = '75%';
                    activeImg.style.height = 'auto';
                    break;
                case 'size-original':
                    activeImg.style.width = '';
                    activeImg.style.height = '';
                    break;
            }

            positionOverlay();
            scheduleSave();
        }

        // ── Event delegation on the editor ──

        state.quill.root.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                e.stopPropagation();
                selectImage(e.target);
            } else {
                deselectImage();
            }
        });

        // Deselect when clicking outside editor
        document.addEventListener('click', (e) => {
            if (overlay && !overlay.contains(e.target) && e.target.tagName !== 'IMG') {
                deselectImage();
            }
        });

        // Reposition overlay on scroll/resize
        const editorContainer = state.quill.root;
        editorContainer.addEventListener('scroll', () => { if (activeImg) positionOverlay(); });
        window.addEventListener('resize', () => { if (activeImg) positionOverlay(); });

        // Delete selected image with Delete/Backspace key
        document.addEventListener('keydown', (e) => {
            if (activeImg && (e.key === 'Delete' || e.key === 'Backspace')) {
                // Only if not typing in another input
                if (document.activeElement === state.quill.root || document.activeElement === document.body) {
                    e.preventDefault();
                    activeImg.remove();
                    deselectImage();
                    scheduleSave();
                    toast('Image removed', 'info');
                }
            }
        });
    }


    // ===== Keyboard Shortcuts =====

    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S — force save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (state.activeNoteId) saveCurrentNote();
            }
            // Ctrl+N — new note
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                createNote();
            }
            // Ctrl+/ — toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                if (dom.sidebar.classList.contains('open') || window.innerWidth >= 768) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            }
            // Escape — close editor / modals
            if (e.key === 'Escape') {
                if (dom.confirmOverlay.classList.contains('show')) {
                    dom.confirmOverlay.classList.remove('show');
                    if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
                } else if (dom.categoryModal.classList.contains('show')) {
                    dom.categoryModal.classList.remove('show');
                } else if (state.activeNoteId) {
                    closeEditor();
                }
            }
        });
    }


    // ===== Event Binding =====

    function bindEvents() {
        // Sidebar
        dom.sidebarToggle.addEventListener('click', openSidebar);
        dom.sidebarClose.addEventListener('click', closeSidebar);

        // Document click to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'));
            }
        });

        // Quick filters (Toggle collapse)
        ['all', 'uncategorized', 'archived'].forEach(id => {
            const el = document.getElementById(`filter-${id}`);
            if (el) {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.new-note-btn')) return;
                    const group = el.closest('.sidebar-group');
                    group.classList.toggle('collapsed');
                });
            }
        });

        const newUncatBtn = document.querySelector('#filter-uncategorized .new-note-btn');
        if (newUncatBtn) {
            newUncatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                createNote('null');
            });
        }

        // Editor back
        dom.editorBack.addEventListener('click', closeEditor);

        // Editor title auto-save
        dom.editorTitle.addEventListener('input', scheduleSave);

        // Pin / Archive / Delete
        dom.btnPin.addEventListener('click', togglePin);
        dom.btnArchive.addEventListener('click', toggleArchive);
        dom.btnDeleteNote.addEventListener('click', deleteCurrentNote);

        // Theme toggle
        dom.themeToggle.addEventListener('click', toggleTheme);

        // Search (debounced)
        let searchTimer;
        dom.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadNotes(), 300);
        });

        // Category modal
        dom.addCategoryBtn.addEventListener('click', () => openCategoryModal());
        dom.categoryModalCancel.addEventListener('click', () => dom.categoryModal.classList.remove('show'));
        dom.categoryModalSave.addEventListener('click', saveCategoryModal);
        dom.catNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveCategoryModal();
        });

        // Emoji & color pickers
        $$('.emoji-option').forEach((opt) => {
            opt.addEventListener('click', () => {
                $$('.emoji-option').forEach((o) => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });
        $$('.color-option').forEach((opt) => {
            opt.addEventListener('click', () => {
                $$('.color-option').forEach((o) => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        // Confirm dialog
        dom.confirmCancel.addEventListener('click', () => {
            dom.confirmOverlay.classList.remove('show');
            if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
        });
        dom.confirmOk.addEventListener('click', () => {
            dom.confirmOverlay.classList.remove('show');
            if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
        });
    }


    // ===== Init =====

    async function init() {
        initTheme();
        initQuill();
        bindEvents();
        initKeyboardShortcuts();
        await loadCategories();
        await loadNotes();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
