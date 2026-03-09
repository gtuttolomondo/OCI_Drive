import oci
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class OCIClient:
    def __init__(self):
        config_file = os.getenv("OCI_CONFIG_FILE", "~/.oci/config")
        config_profile = os.getenv("OCI_CONFIG_PROFILE", "DEFAULT")
        
        # Load OCI config
        try:
            self.config = oci.config.from_file(config_file, config_profile)
            self.object_storage_client = oci.object_storage.ObjectStorageClient(self.config)
            self.namespace = os.getenv("OCI_NAMESPACE")
            self.bucket_name = os.getenv("OCI_BUCKET_NAME")
            
            if not self.namespace or not self.bucket_name:
                # Try to fetch namespace if not provided
                self.namespace = self.object_storage_client.get_namespace().data
        except Exception as e:
            print(f"Error initializing OCI Client: {e}")
            self.config = None

    def list_objects(self, prefix=None, delimiter='/'):
        """Lists objects in the bucket, mimicking a folder structure."""
        if not self.config:
            return []
            
        try:
            list_objects_response = self.object_storage_client.list_objects(
                self.namespace,
                self.bucket_name,
                prefix=prefix,
                delimiter=delimiter,
                fields="name,size,timeCreated,md5"
            )
            
            objects = []
            
            # Add folders (prefixes)
            if list_objects_response.data.prefixes:
                for p in list_objects_response.data.prefixes:
                    objects.append({
                        "name": p.rstrip('/'),
                        "type": "folder",
                        "full_path": p
                    })
            
            # Add files (objects)
            for obj in list_objects_response.data.objects:
                # If using a delimiter, the list_objects call returns objects in the "current folder"
                # but we need to filter out the prefix itself if it's an object (common in OCI)
                if prefix and obj.name == prefix:
                    continue
                    
                objects.append({
                    "name": obj.name.replace(prefix, '') if prefix else obj.name,
                    "type": "file",
                    "size": obj.size,
                    "timeCreated": obj.time_created.isoformat(),
                    "full_path": obj.name
                })
                
            return objects
        except Exception as e:
            print(f"Error listing objects: {e}")
            return []

    def upload_file(self, file_path, object_name, content_type=None):
        """Uploads a file to OCI Object Storage with optional content type."""
        if not self.config:
            return False
            
        try:
            with open(file_path, 'rb') as f:
                self.object_storage_client.put_object(
                    self.namespace,
                    self.bucket_name,
                    object_name,
                    f,
                    content_type=content_type
                )
            return True
        except Exception as e:
            print(f"Error uploading file: {e}")
            return False

    def create_folder(self, folder_path):
        """Creates a virtual folder in OCI Object Storage by putting a zero-byte object ending in /."""
        if not self.config:
            return False
        
        # Ensure the folder path ends with /
        if not folder_path.endswith('/'):
            folder_path += '/'
            
        try:
            self.object_storage_client.put_object(
                self.namespace,
                self.bucket_name,
                folder_path,
                b""
            )
            return True
        except Exception as e:
            print(f"Error creating folder: {e}")
            return False

    def download_file(self, object_name):
        """Downloads a file from OCI Object Storage and returns its content and content type."""
        if not self.config:
            return None, None
            
        try:
            get_object_response = self.object_storage_client.get_object(
                self.namespace,
                self.bucket_name,
                object_name
            )
            return get_object_response.data.content, get_object_response.headers.get('Content-Type')
        except Exception as e:
            print(f"Error downloading file: {e}")
            return None, None

    def delete_object(self, object_name):
        """Deletes an object from OCI Object Storage."""
        if not self.config:
            return False
            
        try:
            self.object_storage_client.delete_object(
                self.namespace,
                self.bucket_name,
                object_name
            )
            return True
        except Exception as e:
            print(f"Error deleting object: {e}")
            return False

    def get_object_details(self, object_name):
        """Gets metadata for a specific object."""
        try:
            response = self.object_storage_client.head_object(
                self.namespace,
                self.bucket_name,
                object_name
            )
            return response.headers
        except oci.exceptions.ServiceError as e:
            if e.status == 404:
                return None
            print(f"Error getting object details: {e}")
            return None
        except Exception as e:
            print(f"Error getting object details: {e}")
            return None

    def object_exists(self, object_name):
        """Checks if an object exists in the bucket."""
        return self.get_object_details(object_name) is not None

    def rename_object(self, old_name, new_name):
        """
        Renames (moves) an object or a folder.
        Uses manual download then upload to avoid 'InsufficientServicePermissions' 
        for the OCI Object Storage service principal.
        """
        if not self.config:
            return False
            
        try:
            # Check if it's a folder (prefix) or a file
            if old_name.endswith('/'):
                # It's a folder: migrate all objects with this prefix
                list_response = self.object_storage_client.list_objects(
                    self.namespace,
                    self.bucket_name,
                    prefix=old_name
                )
                objects = list_response.data.objects
                
                for obj in objects:
                    obj_old_name = obj.name
                    obj_new_name = obj_old_name.replace(old_name, new_name, 1)
                    
                    # Manual Move: Download -> Upload -> Delete
                    content, content_type = self.download_file(obj_old_name)
                    if content:
                        import tempfile
                        with tempfile.NamedTemporaryFile(delete=False) as tf:
                            tf.write(content)
                            temp_path = tf.name
                        
                        try:
                            self.upload_file(temp_path, obj_new_name, content_type=content_type)
                            self.delete_object(obj_old_name)
                        finally:
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
                return True
            else:
                # It's a single file: Manual Move
                content, content_type = self.download_file(old_name)
                if content:
                    import tempfile
                    with tempfile.NamedTemporaryFile(delete=False) as tf:
                        tf.write(content)
                        temp_path = tf.name
                    
                    try:
                        self.upload_file(temp_path, new_name, content_type=content_type)
                        self.delete_object(old_name)
                        return True
                    finally:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                return False
        except Exception as e:
            print(f"Error renaming object manually: {e}")
            return False

    def create_par(self, object_name, time_expires):
        """
        Creates a pre-authenticated request for an object.
        time_expires: datetime object
        """
        if not self.config:
            return None
            
        try:
            par_details = oci.object_storage.models.CreatePreauthenticatedRequestDetails(
                name=f"PAR_{object_name.split('/')[-1]}",
                access_type="ObjectRead",
                time_expires=time_expires,
                object_name=object_name
            )
            
            response = self.object_storage_client.create_preauthenticated_request(
                self.namespace,
                self.bucket_name,
                par_details
            )
            
            # The full URL is formed by the base URL + access_uri
            base_url = self.object_storage_client.base_client.endpoint
            # Remove trailing slash if present in base_url
            base_url = base_url.rstrip('/')
            
            # Check for correct attribute name (SDK varies)
            uri = getattr(response.data, 'access_uri', None) or getattr(response.data, 'accession_uri', None)
            if not uri:
                raise AttributeError("PAR object has no access_uri or accession_uri")
                
            return base_url + uri
        except Exception as e:
            import traceback
            print(f"Error creating PAR for {object_name}:")
            traceback.print_exc()
            return None

    def list_pars(self, object_name):
        """Lists Pre-Authenticated Requests for a specific object."""
        if not self.config:
            return []
            
        try:
            response = self.object_storage_client.list_preauthenticated_requests(
                self.namespace,
                self.bucket_name,
                object_name_prefix=object_name
            )
            
            pars = []
            for par in response.data:
                # OCI filter is by prefix, so we verify exact match if needed
                if par.object_name == object_name:
                    pars.append({
                        "id": par.id,
                        "name": par.name,
                        "time_expires": par.time_expires.isoformat(),
                        "access_uri": par.access_uri if hasattr(par, 'access_uri') else getattr(par, 'accession_uri', None)
                    })
            
            # Sort by expiration (newest first)
            pars.sort(key=lambda x: x['time_expires'], reverse=True)
            return pars
        except Exception as e:
            print(f"Error listing PARs: {e}")
            return []
