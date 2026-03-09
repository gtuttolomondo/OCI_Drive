document.addEventListener('DOMContentLoaded', () => {
    let currentPath = '';
    const fileList = document.getElementById('file-list');
    const breadcrumb = document.getElementById('breadcrumb');
    const uploadTrigger = document.getElementById('upload-trigger');
    const uploadModal = document.getElementById('upload-modal');
    const closeModal = document.getElementById('close-modal');
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const startUpload = document.getElementById('start-upload');
    const cancelUpload = document.getElementById('cancel-upload');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const percentText = document.getElementById('percent-text');
    const uploadStatus = document.getElementById('upload-status');

    // Preview Elements
    const previewModal = document.getElementById('preview-modal');
    const previewContainer = document.getElementById('preview-container');
    const previewTitle = document.getElementById('preview-title');
    const closePreview = document.getElementById('close-preview');
    const previewDownloadBtn = document.getElementById('preview-download-btn');

    // Folder Modal Elements
    const folderModal = document.getElementById('folder-modal');
    const folderNameInput = document.getElementById('folder-name-input');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const newFolderTrigger = document.getElementById('new-folder-trigger');
    const closeFolderModal = document.getElementById('close-folder-modal');
    const cancelFolder = document.getElementById('cancel-folder');

    // Sidebar & View Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const navFiles = document.getElementById('nav-files');
    const navSettings = document.getElementById('nav-settings');
    const navOffline = document.getElementById('nav-offline');
    const navSync = document.getElementById('nav-sync');
    const filesView = document.getElementById('files-view');
    const settingsView = document.getElementById('settings-view');
    const offlineView = document.getElementById('offline-view');
    const syncView = document.getElementById('sync-view');

    // Settings Form Elements
    const settingsForm = document.getElementById('settings-form');
    const settingsFieldsContainer = document.getElementById('settings-fields-container');
    const resetSettingsBtn = document.getElementById('reset-settings');

    // Offline Website Elements
    const offlineForm = document.getElementById('offline-form');
    const offlineFolderSelect = document.getElementById('offline-folder');
    const offlineStatus = document.getElementById('offline-status');
    const offlineStatusText = document.getElementById('offline-status-text');

    // Sync View Elements
    const syncAuthSection = document.getElementById('sync-auth-section');
    const syncProcessSection = document.getElementById('sync-process-section');
    const btnSyncAuth = document.getElementById('btn-sync-auth');
    const btnStartSync = document.getElementById('btn-start-sync');
    const syncFolder = document.getElementById('sync-folder');
    const syncStatus = document.getElementById('sync-status');
    const syncStatusText = document.getElementById('sync-status-text');

    // Rename Elements
    const renameModal = document.getElementById('rename-modal');
    const renameInput = document.getElementById('rename-input');
    const oldNameHidden = document.getElementById('old-name-hidden');
    const renameTypeHidden = document.getElementById('rename-type-hidden');
    const closeRenameModal = document.getElementById('close-rename-modal');
    const cancelRename = document.getElementById('cancel-rename');
    const confirmRenameBtn = document.getElementById('confirm-rename-btn');

    // File Transfer Elements
    const navFileTransfer = document.getElementById('nav-file-transfer');
    const fileTransferView = document.getElementById('file-transfer-view');
    const ftFileList = document.getElementById('ft-file-list');
    const ftUploadTrigger = document.getElementById('ft-upload-trigger');
    const parModal = document.getElementById('par-modal');
    const closeParModal = document.getElementById('close-par-modal');
    const parSetup = document.getElementById('par-setup');
    const parResult = document.getElementById('par-result');
    const parExpiry = document.getElementById('par-expiry');
    const ftGenerateBtn = document.getElementById('ft-generate-btn');
    const parUrlInput = document.getElementById('par-url-input');
    const copyParBtn = document.getElementById('copy-par-btn');
    const parExpiryDate = document.getElementById('par-expiry-date');
    const parDoneBtn = document.getElementById('par-done-btn');
    const existingParsSection = document.getElementById('existing-pars-section');
    const parsList = document.getElementById('pars-list');

    let selectedFile = null;

    // Fetch and display files
    async function loadFiles(path = '') {
        currentPath = path;
        fileList.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 10px;">Loading your files...</p>
            </div>
        `;

        updateBreadcrumb(path);

        try {
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const files = await response.json();

            if (files.length === 0) {
                fileList.innerHTML = `
                    <div style="padding: 80px; text-align: center; color: var(--text-muted);">
                        <i class="fas fa-folder-open fa-4x" style="opacity: 0.2; margin-bottom: 20px;"></i>
                        <p>This folder is empty</p>
                    </div>
                `;
                return;
            }

            fileList.innerHTML = '';
            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'file-item';

                const fileExt = file.type === 'folder' ? '' : file.name.split('.').pop().toLowerCase();
                const iconInfo = getFileIcon(fileExt, file.type);
                const formattedSize = file.type === 'folder' ? '--' : formatBytes(file.size);
                const formattedDate = new Date(file.timeCreated).toLocaleDateString();

                item.innerHTML = `
                    <div class="file-icon ${iconInfo.colorClass}"><i class="fas ${iconInfo.icon} fa-lg"></i></div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formattedSize}</div>
                    <div class="file-date">${formattedDate}</div>
                    <div class="file-actions">
                        ${file.type === 'file' ? `
                            <button class="action-btn view-btn" title="View in Browser">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn download-btn" title="Download">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="action-btn share-btn" title="Generate Share Link">
                                <i class="fas fa-link"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn action-rename" title="Rename">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn action-delete" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

                item.addEventListener('click', (e) => {
                    if (e.target.closest('.action-btn')) return;
                    if (file.type === 'folder') {
                        loadFiles(file.full_path);
                    } else {
                        handlePreview(file);
                    }
                });

                const viewBtn = item.querySelector('.view-btn');
                if (viewBtn) {
                    viewBtn.addEventListener('click', () => {
                        handlePreview(file);
                    });
                }

                const downloadBtn = item.querySelector('.download-btn');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => {
                        window.location.href = `/api/download?name=${encodeURIComponent(file.full_path)}`;
                    });
                }

                const shareBtn = item.querySelector('.share-btn');
                if (shareBtn) {
                    shareBtn.addEventListener('click', () => {
                        openPARModal(file.full_path);
                    });
                }

                const renameBtn = item.querySelector('.action-rename');
                renameBtn.addEventListener('click', () => {
                    oldNameHidden.value = file.full_path;
                    renameTypeHidden.value = file.type;
                    renameInput.value = file.name;
                    renameModal.classList.add('active');
                    renameInput.focus();
                });

                const deleteBtn = item.querySelector('.action-delete');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                        const response = await fetch(`/api/delete?name=${encodeURIComponent(file.full_path)}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            loadFiles(currentPath);
                        } else {
                            alert('Failed to delete file');
                        }
                    }
                });

                fileList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading files:', error);
            fileList.innerHTML = `<p style="padding: 20px; color: #ef4444;">Error loading files. Check OCI configuration.</p>`;
        }
    }

    function updateBreadcrumb(path) {
        breadcrumb.innerHTML = '<a href="#" data-path=""><i class="fas fa-home"></i> Home</a>';
        if (!path) return;

        const parts = path.split('/').filter(p => p);
        let currentBuildPath = '';

        parts.forEach((part, index) => {
            currentBuildPath += part + '/';
            breadcrumb.innerHTML += ` <span>/</span> <a href="#" data-path="${currentBuildPath}">${part}</a>`;
        });

        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                loadFiles(link.dataset.path);
            });
        });
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    async function handlePreview(file) {
        previewTitle.innerText = file.name;
        previewModal.style.display = 'flex';
        previewContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading preview...</p></div>';

        previewDownloadBtn.onclick = () => {
            window.location.href = `/api/download?name=${encodeURIComponent(file.full_path)}`;
        };

        const ext = file.name.split('.').pop().toLowerCase();
        const viewUrl = `/api/view/${file.full_path.startsWith('/') ? file.full_path.substring(1) : file.full_path}`;

        if (ext === 'docx') {
            try {
                const response = await fetch(viewUrl);
                const blob = await response.blob();
                previewContainer.innerHTML = '';
                await docx.renderAsync(blob, previewContainer);
            } catch (error) {
                console.error('Docx view error:', error);
                previewContainer.innerHTML = '<p style="color: #ef4444; padding: 20px;">Failed to render Word document.</p>';
            }
        } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
            previewContainer.innerHTML = `<img src="${viewUrl}" alt="${file.name}">`;
        } else if (ext === 'pdf' || ext === 'txt' || ext === 'html') {
            previewContainer.innerHTML = `<iframe src="${viewUrl}"></iframe>`;
        } else {
            previewContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas ${getFileIcon(ext, 'file').icon} fa-4x" style="opacity: 0.2; margin-bottom: 20px;"></i>
                    <p>Browser cannot preview this file type natively.</p>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="window.location.href='/api/download?name=${encodeURIComponent(file.full_path)}'">
                        Download to View
                    </button>
                </div>
            `;
        }
    }

    function getFileIcon(ext, type) {
        if (type === 'folder') return { icon: 'fa-folder', colorClass: 'icon-folder' };

        const mapping = {
            'pdf': { icon: 'fa-file-pdf', colorClass: 'icon-pdf' },
            'doc': { icon: 'fa-file-word', colorClass: 'icon-word' },
            'docx': { icon: 'fa-file-word', colorClass: 'icon-word' },
            'xls': { icon: 'fa-file-excel', colorClass: 'icon-excel' },
            'xlsx': { icon: 'fa-file-excel', colorClass: 'icon-excel' },
            'ppt': { icon: 'fa-file-powerpoint', colorClass: 'icon-powerpoint' },
            'pptx': { icon: 'fa-file-powerpoint', colorClass: 'icon-powerpoint' },
            'jpg': { icon: 'fa-file-image', colorClass: 'icon-image' },
            'jpeg': { icon: 'fa-file-image', colorClass: 'icon-image' },
            'png': { icon: 'fa-file-image', colorClass: 'icon-image' },
            'gif': { icon: 'fa-file-image', colorClass: 'icon-image' },
            'svg': { icon: 'fa-file-image', colorClass: 'icon-image' },
            'txt': { icon: 'fa-file-alt', colorClass: 'icon-text' },
            'zip': { icon: 'fa-file-archive', colorClass: 'icon-archive' },
            'rar': { icon: 'fa-file-archive', colorClass: 'icon-archive' },
            'mp4': { icon: 'fa-file-video', colorClass: 'icon-video' },
            'mov': { icon: 'fa-file-video', colorClass: 'icon-video' },
            'mp3': { icon: 'fa-file-audio', colorClass: 'icon-audio' },
            'wav': { icon: 'fa-file-audio', colorClass: 'icon-audio' },
            'html': { icon: 'fa-file-code', colorClass: 'icon-code' },
            'css': { icon: 'fa-file-code', colorClass: 'icon-code' },
            'js': { icon: 'fa-file-code', colorClass: 'icon-code' },
            'json': { icon: 'fa-file-code', colorClass: 'icon-code' }
        };

        return mapping[ext] || { icon: 'fa-file', colorClass: 'icon-generic' };
    }

    closePreview.onclick = () => {
        previewModal.style.display = 'none';
        previewContainer.innerHTML = '';
    };

    // Sidebar & View Switching Logic
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }

    sidebarToggle.onclick = sidebarOverlay.onclick = toggleSidebar;

    function switchView(viewName) {
        const views = {
            'files': filesView,
            'settings': settingsView,
            'offline': offlineView,
            'sync': syncView,
            'filetransfer': fileTransferView
        };

        const navs = {
            'files': navFiles,
            'settings': navSettings,
            'offline': navOffline,
            'sync': navSync,
            'filetransfer': navFileTransfer
        };

        Object.keys(views).forEach(v => {
            if (views[v]) views[v].style.display = (v === viewName) ? 'block' : 'none';
            if (navs[v]) {
                if (v === viewName) navs[v].classList.add('active');
                else navs[v].classList.remove('active');
            }
        });

        if (viewName === 'files') loadFiles(currentPath);
        else if (viewName === 'settings') loadAppSettings();
        else if (viewName === 'offline') loadFoldersForOffline();
        else if (viewName === 'sync') loadFoldersForSync();
        else if (viewName === 'filetransfer') initFileTransfer();

        if (sidebar.classList.contains('open')) toggleSidebar();
    }

    navFiles.onclick = (e) => {
        e.preventDefault();
        switchView('files');
    };

    navSettings.onclick = (e) => {
        e.preventDefault();
        switchView('settings');
    };

    navOffline.onclick = (e) => {
        e.preventDefault();
        switchView('offline');
    };

    navSync.onclick = (e) => {
        e.preventDefault();
        switchView('sync');
    };

    navFileTransfer.onclick = (e) => {
        e.preventDefault();
        switchView('filetransfer');
    };

    // Settings Management Logic
    async function loadAppSettings() {
        settingsFieldsContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            settingsFieldsContainer.innerHTML = '';

            const labels = {
                'OCI_CONFIG_FILE': 'OCI Config File Path',
                'OCI_CONFIG_PROFILE': 'OCI Config Profile Name',
                'OCI_NAMESPACE': 'OCI Object Storage Namespace',
                'OCI_BUCKET_NAME': 'OCI Bucket Name',
                'OCI_COMPARTMENT_ID': 'OCI Compartment OCID',
                'FLASK_SECRET_KEY': 'Flask Secret Key'
            };

            for (const [key, value] of Object.entries(settings)) {
                const group = document.createElement('div');
                group.className = 'settings-group';
                group.innerHTML = `
                    <label class="settings-label" for="setting-${key}">${labels[key] || key}</label>
                    <input type="text" class="settings-input" id="setting-${key}" name="${key}" value="${value}">
                    <span class="settings-help">CORRESPONDS TO ${key} in .env</span>
                `;
                settingsFieldsContainer.appendChild(group);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            settingsFieldsContainer.innerHTML = '<p style="color: #ef4444;">Error loading settings.</p>';
        }
    }

    settingsForm.onsubmit = async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-settings');
        const originalText = saveBtn.innerText;

        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        const formData = new FormData(settingsForm);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings.');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('An error occurred while saving.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = originalText;
        }
    };

    resetSettingsBtn.onclick = () => {
        if (confirm('Discard all unsaved changes?')) {
            loadAppSettings();
        }
    };

    // Offline Websites Logic
    async function loadFoldersForOffline() {
        try {
            const response = await fetch('/api/files');
            const items = await response.json();
            const folders = items.filter(i => i.type === 'folder');

            offlineFolderSelect.innerHTML = '<option value="">/ (Root)</option>';
            folders.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.full_path;
                opt.textContent = f.full_path;
                offlineFolderSelect.appendChild(opt);
            });
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    }

    offlineForm.onsubmit = async (e) => {
        e.preventDefault();
        const url = document.getElementById('offline-url').value;
        const folder = offlineFolderSelect.value;
        const filename = document.getElementById('offline-filename').value;
        const submitBtn = document.getElementById('save-offline');

        submitBtn.disabled = true;
        offlineStatus.style.display = 'block';
        offlineStatusText.textContent = 'Capturing website assets...';

        try {
            const response = await fetch('/api/offline-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, folder, filename })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                offlineForm.reset();
                switchView('files');
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Capture error:', error);
            alert('An unexpected error occurred during capture.');
        } finally {
            submitBtn.disabled = false;
            offlineStatus.style.display = 'none';
        }
    };

    // Folder Logic
    newFolderTrigger.onclick = () => {
        folderModal.style.display = 'flex';
        folderNameInput.value = '';
        folderNameInput.focus();
    };

    closeFolderModal.onclick = cancelFolder.onclick = () => {
        folderModal.style.display = 'none';
    };

    createFolderBtn.onclick = async () => {
        const folderName = folderNameInput.value.trim();
        if (!folderName) return;

        createFolderBtn.disabled = true;
        try {
            const response = await fetch('/api/create-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentPath,
                    folder_name: folderName
                })
            });

            if (response.ok) {
                folderModal.style.display = 'none';
                loadFiles(currentPath);
            } else {
                const data = await response.json();
                alert('Error creating folder: ' + data.error);
            }
        } catch (error) {
            console.error('Folder creation error:', error);
        } finally {
            createFolderBtn.disabled = false;
        }
    };

    // Modal & Upload Logic
    uploadTrigger.onclick = () => {
        uploadModal.style.display = 'flex';
        resetUpload();
    };

    closeModal.onclick = cancelUpload.onclick = () => {
        uploadModal.style.display = 'none';
        resetUpload();
    };

    function resetUpload() {
        selectedFile = null;
        fileInput.value = '';
        dropArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt fa-3x" style="color: var(--secondary); margin-bottom: 16px;"></i>
            <p>Drag and drop files here or click to browse</p>
            <input type="file" id="file-input" style="display: none;">
        `;
        startUpload.disabled = true;
        uploadStatus.style.display = 'none';
        progressBar.style.width = '0%';
        percentText.innerText = '0%';
    }

    dropArea.onclick = () => fileInput.click();

    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });

    ['dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, () => dropArea.classList.remove('drag-over'));
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFileSelect(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
        if (!file) return;
        selectedFile = file;
        dropArea.innerHTML = `
            <i class="fas fa-file-alt fa-3x" style="color: var(--secondary); margin-bottom: 16px;"></i>
            <p style="font-weight: 600;">${file.name}</p>
            <p style="font-size: 14px; color: var(--text-muted);">${formatBytes(file.size)}</p>
        `;
        startUpload.disabled = false;
    }

    startUpload.onclick = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('path', currentPath);

        uploadStatus.style.display = 'block';
        startUpload.disabled = true;
        cancelUpload.disabled = true;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percent + '%';
                percentText.innerText = percent + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                setTimeout(() => {
                    uploadModal.style.display = 'none';
                    if (navFileTransfer.classList.contains('active')) {
                        loadFTFiles();
                    } else {
                        loadFiles(currentPath);
                    }
                }, 500);
            } else {
                alert('Upload failed: ' + xhr.responseText);
                resetUpload();
            }
        };

        xhr.onerror = () => {
            alert('Error during upload');
            resetUpload();
        };

        xhr.send(formData);
    };

    // Initial Load
    loadFiles();
    // Google Drive Sync Logic
    async function loadFoldersForSync() {
        syncFolder.innerHTML = '<option value="">/ (Root)</option>';
        try {
            const response = await fetch('/api/files');
            const files = await response.json();
            const folders = files.filter(f => f.type === 'folder');
            folders.forEach(f => {
                const option = document.createElement('option');
                option.value = f.full_path;
                option.textContent = f.full_path;
                syncFolder.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading folders for sync:', error);
        }
    }

    btnSyncAuth.onclick = async () => {
        try {
            const response = await fetch('/api/gdrive/auth');
            const data = await response.json();
            if (data.url) {
                window.open(data.url, 'GoogleAuth', 'width=600,height=600');
            } else {
                alert('Error: ' + (data.error || 'Failed to get auth URL'));
            }
        } catch (error) {
            alert('Auth error: ' + error.message);
        }
    };

    window.addEventListener('message', (event) => {
        if (event.data === 'gdrive-auth-success') {
            syncAuthSection.style.display = 'none';
            syncProcessSection.style.display = 'block';
            loadFoldersForSync();
        }
    });

    btnStartSync.onclick = async () => {
        const folder = syncFolder.value;
        syncStatus.style.display = 'block';
        btnStartSync.disabled = true;

        try {
            const response = await fetch('/api/gdrive/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: folder })
            });
            const data = await response.json();
            if (data.message) {
                syncStatus.className = 'status-success';
                let statusHtml = `<i class="fas fa-check-circle"></i> ${data.message}`;

                if (data.skipped && data.skipped.length > 0) {
                    statusHtml += `<div style="margin-top: 15px; text-align: left; font-size: 13px; max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px;">`;
                    statusHtml += `<strong>Skipped/Failed files (${data.skipped.length}):</strong><ul style="margin: 5px 0; padding-left: 20px;">`;
                    data.skipped.forEach(s => {
                        statusHtml += `<li>${s.name}: <span style="opacity: 0.7;">${s.error}</span></li>`;
                    });
                    statusHtml += `</ul></div>`;
                }

                syncStatus.innerHTML = statusHtml;
                setTimeout(() => loadFiles(currentPath), 5000);
            } else {
                throw new Error(data.error || 'Sync failed');
            }
        } catch (error) {
            syncStatus.style.background = '#fef2f2';
            syncStatus.style.color = '#ef4444';
            syncStatusText.innerText = 'Error: ' + error.message;
        } finally {
            btnStartSync.disabled = false;
        }
    };

    // --- Rename Logic ---
    closeRenameModal.onclick = () => renameModal.classList.remove('active');
    cancelRename.onclick = () => renameModal.classList.remove('active');

    confirmRenameBtn.onclick = async () => {
        const oldPath = oldNameHidden.value;
        const type = renameTypeHidden.value;
        const newName = renameInput.value.trim();

        if (!newName) return;

        // Construct new path
        const pathParts = oldPath.split('/');
        let parentPath = "";

        if (type === 'folder') {
            // Folder example: "test/subfolder/"
            parentPath = pathParts.slice(0, pathParts.length - 2).join('/');
            if (parentPath) parentPath += '/';
        } else {
            // File example: "test/file.txt"
            parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
            if (parentPath) parentPath += '/';
        }

        let newPath = parentPath + newName;
        if (type === 'folder' && !newPath.endsWith('/')) newPath += '/';

        if (oldPath === newPath) {
            renameModal.classList.remove('active');
            return;
        }

        confirmRenameBtn.disabled = true;
        confirmRenameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Renaming...';

        try {
            const response = await fetch('/api/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_name: oldPath, new_name: newPath })
            });

            const data = await response.json();
            if (response.ok) {
                renameModal.classList.remove('active');
                loadFiles(currentPath);
            } else {
                alert('Rename failed: ' + data.error);
            }
        } catch (error) {
            alert('Error renaming: ' + error.message);
        } finally {
            confirmRenameBtn.disabled = false;
            confirmRenameBtn.innerHTML = 'Rename';
        }
    };

    // --- File Transfer Logic ---
    async function initFileTransfer() {
        if (!ftFileList) return;
        ftFileList.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        try {
            const response = await fetch('/api/filetransfer/init');
            const data = await response.json();
            if (response.ok) {
                loadFTFiles();
            } else {
                alert('Init error: ' + data.error);
            }
        } catch (error) {
            console.error('FT Init error:', error);
        }
    }

    async function loadFTFiles() {
        if (!ftFileList) return;
        ftFileList.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        try {
            const response = await fetch('/api/files?path=FileTransfer/');
            const files = await response.json();

            if (files.length === 0) {
                ftFileList.innerHTML = `
                    <div style="padding: 80px; text-align: center; color: var(--text-muted);">
                        <i class="fas fa-paper-plane fa-4x" style="opacity: 0.1; margin-bottom: 20px;"></i>
                        <p>No files in File Transfer. Upload something to share!</p>
                    </div>
                `;
                return;
            }

            ftFileList.innerHTML = '';
            files.forEach(file => {
                if (file.name === '' || file.name === 'FileTransfer/') return;
                const item = document.createElement('div');
                item.className = 'file-item';
                const fileExt = file.name.split('.').pop().toLowerCase();
                const iconInfo = getFileIcon(fileExt, file.type);
                const formattedSize = file.type === 'folder' ? '--' : formatBytes(file.size);

                item.innerHTML = `
                    <div class="file-icon ${iconInfo.colorClass}"><i class="fas ${iconInfo.icon} fa-lg"></i></div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formattedSize}</div>
                    <div class="file-actions">
                        <button class="btn btn-primary btn-sm par-btn" style="padding: 4px 10px; font-size: 12px; height: auto;">
                            <i class="fa-solid fa-link"></i> Get Link
                        </button>
                        <button class="action-btn ft-delete-btn" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

                const parBtn = item.querySelector('.par-btn');
                parBtn.onclick = (e) => {
                    e.stopPropagation();
                    openPARModal(file.full_path);
                };

                const deleteBtn = item.querySelector('.ft-delete-btn');
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm(`Rimuovere definitivamente "${file.name}"?`)) {
                        try {
                            const response = await fetch(`/api/delete?name=${encodeURIComponent(file.full_path)}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                loadFTFiles();
                            } else {
                                alert('Error deleting file');
                            }
                        } catch (error) {
                            console.error('Delete error:', error);
                        }
                    }
                };

                ftFileList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading FT files:', error);
            ftFileList.innerHTML = '<p style="color: #ef4444; padding: 20px;">Error loading files.</p>';
        }
    }

    let parTargetFile = "";
    function openPARModal(fullPath) {
        parTargetFile = fullPath;
        if (parSetup) parSetup.style.display = 'block';
        if (parResult) parResult.style.display = 'none';
        if (parModal) parModal.classList.add('active');
        loadExistingPARs(fullPath);
    }

    async function loadExistingPARs(objectName) {
        if (!parsList || !existingParsSection) return;
        parsList.innerHTML = '<div style="font-size: 12px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Checking existing links...</div>';
        existingParsSection.style.display = 'block';

        try {
            const response = await fetch(`/api/par/list?object_name=${encodeURIComponent(objectName)}`);
            const pars = await response.json();

            if (pars.length === 0) {
                existingParsSection.style.display = 'none';
                return;
            }

            parsList.innerHTML = '';
            pars.forEach(par => {
                const parDate = new Date(par.time_expires);
                const isExpired = parDate < new Date();

                if (isExpired) return; // Don't show expired ones

                const parItem = document.createElement('div');
                parItem.style.cssText = 'background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 12px;';
                parItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: var(--text);">Active Link</span>
                        <span style="color: #10b981;"><i class="fas fa-check-circle"></i> Active</span>
                    </div>
                    <div style="color: var(--text-muted); margin-bottom: 8px; word-break: break-all; cursor: pointer;" class="existing-par-url" title="Click to copy">
                        ${par.full_url}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted);">
                        <i class="fas fa-clock"></i> Expires: ${parDate.toLocaleString()}
                    </div>
                `;

                parItem.querySelector('.existing-par-url').onclick = () => {
                    navigator.clipboard.writeText(par.full_url);
                    alert('Link copied to clipboard!');
                };

                parsList.appendChild(parItem);
            });

            if (parsList.innerHTML === '') {
                existingParsSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading existing PARs:', error);
            existingParsSection.style.display = 'none';
        }
    }

    if (closeParModal) closeParModal.onclick = () => parModal.classList.remove('active');
    if (parDoneBtn) parDoneBtn.onclick = () => parModal.classList.remove('active');

    if (ftGenerateBtn) {
        ftGenerateBtn.onclick = async () => {
            const hours = parExpiry.value;
            ftGenerateBtn.disabled = true;
            ftGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

            try {
                const response = await fetch('/api/par/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ object_name: parTargetFile, hours: hours })
                });
                const data = await response.json();
                if (response.ok) {
                    parUrlInput.value = data.par_url;
                    parExpiryDate.innerText = data.expires;
                    parSetup.style.display = 'none';
                    parResult.style.display = 'block';
                    loadExistingPARs(parTargetFile); // Refresh list
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Error creating link: ' + error.message);
            } finally {
                ftGenerateBtn.disabled = false;
                ftGenerateBtn.innerHTML = 'Generate Link';
            }
        };
    }

    if (copyParBtn) {
        copyParBtn.onclick = () => {
            parUrlInput.select();
            document.execCommand('copy');
            const oldContent = copyParBtn.innerHTML;
            copyParBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => copyParBtn.innerHTML = oldContent, 2000);
        };
    }

    if (ftUploadTrigger) {
        ftUploadTrigger.onclick = () => {
            currentPath = 'FileTransfer/';
            uploadModal.style.display = 'flex';
            resetUpload();
        };
    }
});
