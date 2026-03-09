import os, mimetypes, shutil, json, uuid
from flask import Flask, render_template, request, send_file, jsonify, redirect, url_for, session
from oci_client import OCIClient
from io import BytesIO
from dotenv import load_dotenv, set_key
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import base64

# Google API Imports
from datetime import datetime, timedelta, timezone
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

load_dotenv()

# Allow insecure transport for local OAuth testing
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-key-for-oci-drive")

oci_client = OCIClient()

# Google Drive Scopes
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

@app.route('/')
def index():
    path = request.args.get('path', '')
    return render_template('index.html', current_path=path)

@app.route('/api/files')
def list_files():
    path = request.args.get('path', '')
    # Ensure nested paths end with / for OCI delimiter logic
    prefix = path if not path or path.endswith('/') else f"{path}/"
    files = oci_client.list_objects(prefix=prefix)
    return jsonify(files)

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    path = request.form.get('path', '')
    object_name = f"{path}{file.filename}" if not path or path.endswith('/') else f"{path}/{file.filename}"
    
    # Save file temporarily to upload
    temp_path = os.path.join('/tmp', file.filename)
    file.save(temp_path)
    
    # Detect content type for OCI storage
    content_type, _ = mimetypes.guess_type(file.filename)
    if not content_type:
        content_type = 'application/octet-stream'

    success = oci_client.upload_file(temp_path, object_name, content_type=content_type)
    os.remove(temp_path)
    
    if success:
        return jsonify({"message": "File uploaded successfully"})
    else:
        return jsonify({"error": "Failed to upload file"}), 500

@app.route('/api/create-folder', methods=['POST'])
def create_folder():
    data = request.json
    path = data.get('path', '')
    folder_name = data.get('folder_name')
    
    if not folder_name:
        return jsonify({"error": "No folder name provided"}), 400
    
    full_path = f"{path}{folder_name}/" if not path or path.endswith('/') else f"{path}/{folder_name}/"
    success = oci_client.create_folder(full_path)
    
    if success:
        return jsonify({"message": "Folder created successfully"})
    else:
        return jsonify({"error": "Failed to create folder"}), 500

@app.route('/api/download')
def download():
    object_name = request.args.get('name')
    if not object_name:
        return jsonify({"error": "No object name provided"}), 400
    
    content, content_type = oci_client.download_file(object_name)
    if content:
        filename = object_name.split('/')[-1]
        return send_file(
            BytesIO(content),
            download_name=filename,
            as_attachment=True,
            mimetype=content_type
        )
    else:
        return jsonify({"error": "Failed to download file"}), 404

@app.route('/api/view/<path:object_name>')
def view(object_name):
    if not object_name:
        return jsonify({"error": "No object name provided"}), 400
    
    content, content_type = oci_client.download_file(object_name)
    if content:
        # If OCI doesn't provide a specific content type, guess it from the extension
        if not content_type or content_type == 'application/octet-stream':
            content_type, _ = mimetypes.guess_type(object_name)
            if not content_type:
                content_type = 'application/octet-stream'

        response = send_file(
            BytesIO(content),
            mimetype=content_type,
            as_attachment=False
        )
        # Force Content-Disposition to inline
        response.headers['Content-Disposition'] = f'inline; filename="{object_name.split("/")[-1]}"'
        # Set cache control to avoid reloading assets too aggressively
        response.headers['Cache-Control'] = 'no-cache'
        return response
    else:
        return jsonify({"error": "Failed to download file"}), 404

@app.route('/api/delete', methods=['DELETE'])
def delete():
    object_name = request.args.get('name')
    if not object_name:
        return jsonify({"error": "No object name provided"}), 400
    
    success = oci_client.delete_object(object_name)
    if success:
        return jsonify({"message": "File deleted successfully"})
    else:
        return jsonify({"error": "Failed to delete file"}), 500

@app.route('/api/rename', methods=['POST'])
def rename():
    data = request.json
    old_name = data.get('old_name')
    new_name = data.get('new_name')
    
    if not old_name or not new_name:
        return jsonify({"error": "Both old and new names are required"}), 400
    
    success = oci_client.rename_object(old_name, new_name)
    if success:
        return jsonify({"message": "Successfully renamed"})
    else:
        return jsonify({"error": "Failed to rename"}), 500

@app.route('/api/settings', methods=['GET'])
def get_settings():
    # Only return specific keys for security
    keys = [
        "OCI_CONFIG_FILE", "OCI_CONFIG_PROFILE", "OCI_NAMESPACE", 
        "OCI_BUCKET_NAME", "OCI_COMPARTMENT_ID", "FLASK_SECRET_KEY",
        "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"
    ]
    settings = {key: os.getenv(key, "") for key in keys}
    return jsonify(settings)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    # We use set_key from python-dotenv to update the .env file
    for key, value in data.items():
        set_key(env_path, key, value)
    
    # Reload environment variables in the current process
    load_dotenv(env_path, override=True)
    
    # Re-initialize OCI client with new settings
    global oci_client
    from oci_client import OCIClient
    oci_client = OCIClient()
    
    return jsonify({"message": "Settings updated successfully. Some changes may require a restart if they affect OCI initialization."})

@app.route('/api/filetransfer/init')
def init_filetransfer():
    folder_name = "FileTransfer/"
    # Check if folder already exists (virtual folders in OCI are just objects ending with /)
    if not oci_client.object_exists(folder_name):
        success = oci_client.create_folder(folder_name)
        if not success:
            return jsonify({"error": "Failed to create FileTransfer folder"}), 500
    return jsonify({"message": "FileTransfer folder ready", "folder": folder_name})

@app.route('/api/par/create', methods=['POST'])
def create_par_route():
    data = request.json
    object_name = data.get('object_name')
    hours = int(data.get('hours', 24))
    
    if not object_name:
        return jsonify({"error": "Object name is required"}), 400
        
    # Calculate expiration time (OCI requires offset-aware datetime object)
    time_expires = datetime.now(timezone.utc) + timedelta(hours=hours)
    
    par_url = oci_client.create_par(object_name, time_expires)
    if par_url:
        return jsonify({
            "par_url": par_url, 
            "expires": time_expires.strftime("%Y-%m-%d %H:%M:%S UTC")
        })
    else:
        return jsonify({"error": "Failed to create PAR"}), 500

@app.route('/api/par/list')
def list_pars_route():
    object_name = request.args.get('object_name')
    if not object_name:
        return jsonify({"error": "Object name is required"}), 400
        
    pars = oci_client.list_pars(object_name)
    
    # Prepend base URL to access_uri if not already a full URL
    base_url = oci_client.object_storage_client.base_client.endpoint.rstrip('/')
    
    for par in pars:
        if par['access_uri'] and not par['access_uri'].startswith('http'):
            par['full_url'] = base_url + par['access_uri']
        else:
            par['full_url'] = par['access_uri']
            
    return jsonify(pars)

# --- Google Drive Sync Logic ---

@app.route('/api/gdrive/auth')
def gdrive_auth():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    if not client_id or not client_secret or not redirect_uri:
        return jsonify({"error": "Google credentials missing in settings"}), 400
        
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    
    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    session.permanent = True
    session['state'] = state
    session['code_verifier'] = flow.code_verifier
    print(f"DEBUG AUTH: state={state}, verifier={flow.code_verifier}")
    
    return jsonify({"url": authorization_url})

@app.route('/api/gdrive/callback')
def gdrive_callback():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=session.get('state'))
    flow.redirect_uri = redirect_uri
    
    print(f"DEBUG CALLBACK: state_in_session={session.get('state')}, verifier_in_session={session.get('code_verifier')}")
    authorization_response = request.url.replace('http:', 'https:') if 'https:' not in request.url and not request.host.startswith('localhost') else request.url
    flow.fetch_token(authorization_response=authorization_response, code_verifier=session.get('code_verifier'))
    
    credentials = flow.credentials
    session['gdrive_tokens'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }
    
    return "<script>window.opener.postMessage('gdrive-auth-success', '*'); window.close();</script>"

def get_gdrive_service():
    tokens = session.get('gdrive_tokens')
    if not tokens:
        return None
    creds = Credentials(**tokens)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        session['gdrive_tokens']['token'] = creds.token
    return build('drive', 'v3', credentials=creds)

@app.route('/api/gdrive/sync', methods=['POST'])
def gdrive_sync():
    service = get_gdrive_service()
    if not service:
        return jsonify({"error": "Not authenticated with Google"}), 401
        
    data = request.json
    oci_parent_folder = data.get('folder', '')
    
    skipped_files = []

    try:
        # Recursive sync function
        def sync_folder(drive_folder_id, oci_prefix):
            query = f"'{drive_folder_id}' in parents and trashed = false"
            results = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
            items = results.get('files', [])
            
            count = 0
            for item in items:
                try:
                    # Sanitize folder and file names (remove newlines and other invalid chars)
                    clean_name = item['name'].replace('\n', ' ').replace('\r', ' ').strip()
                    if not clean_name: clean_name = f"unnamed_{item['id']}"

                    if item['mimeType'] == 'application/vnd.google-apps.folder':
                        # Create folder in OCI
                        new_oci_prefix = f"{oci_prefix}{clean_name}/"
                        oci_client.create_folder(new_oci_prefix)
                        count += sync_folder(item['id'], new_oci_prefix)
                    elif 'shortcut' in item['mimeType'] or 'form' in item['mimeType'] or 'site' in item['mimeType']:
                        print(f"Skipping unsupported Google type: {item['name']} ({item['mimeType']})")
                        continue
                    else:
                        # Download and upload file
                        file_id = item['id']
                        file_name = clean_name
                        mime_type = item['mimeType']

                        # Adjust filename for export formats
                        if 'application/vnd.google-apps' in mime_type:
                            ext = '.pdf'
                            if 'document' in mime_type: ext = '.docx'
                            elif 'spreadsheet' in mime_type: ext = '.xlsx'
                            elif 'presentation' in mime_type: ext = '.pptx'
                            if not file_name.lower().endswith(ext):
                                file_name += ext
                        
                        oci_path = f"{oci_prefix}{file_name}"
                        
                        # Check if file exists in OCI
                        if oci_client.object_exists(oci_path):
                            print(f"Already exists, skipping: {oci_path}")
                            count += 1 # Count as synced even if skipped
                            continue

                        print(f"Syncing: {oci_path}...")
                        temp_path = os.path.join('/tmp', f"sync_{uuid.uuid4().hex}_{file_name}")
                        
                        try:
                            # Handle Google-specific formats by exporting them
                            if 'application/vnd.google-apps' in mime_type:
                                export_mime = 'application/pdf'
                                if '.docx' in file_name: export_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                elif '.xlsx' in file_name: export_mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                elif '.pptx' in file_name: export_mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                                
                                try:
                                    request_file = service.files().export_media(fileId=file_id, mimeType=export_mime)
                                    mime_type = export_mime
                                except Exception as e:
                                    print(f"Export failed for {file_name}: {e}. Skipping.")
                                    skipped_files.append({"name": file_name, "error": f"Export failed: {str(e)}"})
                                    continue
                            else:
                                request_file = service.files().get_media(fileId=file_id)
                            
                            with open(temp_path, 'wb') as f:
                                downloader = MediaIoBaseDownload(f, request_file)
                                done = False
                                while not done:
                                    _, done = downloader.next_chunk()
                            
                            success = oci_client.upload_file(temp_path, oci_path, content_type=mime_type)
                            if success:
                                count += 1
                            else:
                                print(f"Upload failed for {oci_path}")
                                skipped_files.append({"name": oci_path, "error": "OCI Upload failed"})
                        finally:
                            if os.path.exists(temp_path): os.remove(temp_path)
                except Exception as entry_error:
                    print(f"Error processing {item.get('name', 'unknown')}: {entry_error}")
                    skipped_files.append({"name": item.get('name', 'unknown'), "error": str(entry_error)})
                    continue
            return count

        total = sync_folder('root', oci_parent_folder)
        return jsonify({
            "message": f"Sync completed! {total} files migrated.", 
            "count": total,
            "skipped": skipped_files
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def capture_website(url, base_temp_dir):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        base_url = url
        
        assets_dir = os.path.join(base_temp_dir, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        
        # Download images
        for idx, img in enumerate(soup.find_all('img')):
            img_src = img.get('src')
            if img_src:
                full_img_url = urljoin(base_url, img_src)
                try:
                    img_resp = requests.get(full_img_url, headers=headers, timeout=5)
                    if img_resp.status_code == 200:
                        img_ext = os.path.splitext(urlparse(full_img_url).path)[1] or '.png'
                        img_name = f'img_{idx}{img_ext}'
                        with open(os.path.join(assets_dir, img_name), 'wb') as f:
                            f.write(img_resp.content)
                        img['src'] = f'assets/{img_name}'
                except: pass
        
        # Download stylesheets
        for idx, link in enumerate(soup.find_all('link', rel='stylesheet')):
            css_url = link.get('href')
            if css_url:
                full_css_url = urljoin(base_url, css_url)
                try:
                    css_resp = requests.get(full_css_url, headers=headers, timeout=5)
                    if css_resp.status_code == 200:
                        css_name = f'style_{idx}.css'
                        with open(os.path.join(assets_dir, css_name), 'w', encoding='utf-8') as f:
                            f.write(css_resp.text)
                        link['href'] = f'assets/{css_name}'
                except: pass

        # Download scripts
        for idx, script in enumerate(soup.find_all('script', src=True)):
            js_url = script.get('src')
            if js_url:
                full_js_url = urljoin(base_url, js_url)
                try:
                    js_resp = requests.get(full_js_url, headers=headers, timeout=5)
                    if js_resp.status_code == 200:
                        js_name = f'script_{idx}.js'
                        with open(os.path.join(assets_dir, js_name), 'w', encoding='utf-8') as f:
                            f.write(js_resp.text)
                        script['src'] = f'assets/{js_name}'
                except: pass

        # Save index.html
        with open(os.path.join(base_temp_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(str(soup))
            
        return soup.title.string if soup.title else "captured_site"
    except Exception as e:
        raise Exception(f"Failed to capture website: {str(e)}")

@app.route('/api/offline-capture', methods=['POST'])
def offline_capture():
    data = request.json
    url = data.get('url')
    parent_folder = data.get('folder', '')
    custom_name = data.get('filename')
    
    if not url:
        return jsonify({"error": "URL is required"}), 400
        
    try:
        # Create a temporary directory for the site
        import uuid
        site_id = str(uuid.uuid4())[:8]
        temp_site_dir = f"/tmp/website_{site_id}"
        os.makedirs(temp_site_dir, exist_ok=True)
        
        title = capture_website(url, temp_site_dir)
        
        # Sanitize folder name
        folder_name = custom_name if custom_name else title
        folder_name = "".join([c for c in folder_name if c.isalnum() or c in (' ', '-', '_')]).rstrip()
        folder_name = folder_name.replace(' ', '_')
        
        # Base OCI prefix for this site
        oci_prefix = f"{parent_folder}{folder_name}/" if parent_folder else f"{folder_name}/"
        
        # Upload all files recursively
        count = 0
        for root, dirs, files in os.walk(temp_site_dir):
            for file in files:
                local_path = os.path.join(root, file)
                # Calculate OCI path
                rel_path = os.path.relpath(local_path, temp_site_dir)
                oci_path = oci_prefix + rel_path
                
                content_type, _ = mimetypes.guess_type(local_path)
                oci_client.upload_file(local_path, oci_path, content_type=content_type)
                count += 1
        
        shutil.rmtree(temp_site_dir)
        
        return jsonify({
            "message": f"Website captured successfully!",
            "folder": oci_prefix,
            "file_count": count
        })
            
    except Exception as e:
        if 'temp_site_dir' in locals(): shutil.rmtree(temp_site_dir, ignore_errors=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
