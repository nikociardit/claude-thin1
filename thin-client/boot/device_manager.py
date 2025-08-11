#!/usr/bin/env python3
"""
VDI Thin Client Device Manager
Manages device registration, PXE configuration, and deployment orchestration
"""

import os
import sys
import json
import shutil
import hashlib
import logging
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DeviceManager:
    """Manages thin client devices and deployments"""
    
    def __init__(self, config_path: str = "/etc/vdi/device-manager.conf"):
        self.config = self.load_config(config_path)
        self.tftp_root = Path(self.config.get("tftp_root", "/var/lib/tftpboot"))
        self.http_root = Path(self.config.get("http_root", "/var/www/html/images"))
        self.db_path = self.config.get("database_path", "/var/lib/vdi/devices.db")
        
        # Initialize database
        self.init_database()
        
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "tftp_root": "/var/lib/tftpboot",
            "http_root": "/var/www/html/images",
            "database_path": "/var/lib/vdi/devices.db",
            "pxe_server_ip": "192.168.100.1",
            "default_deployment_timeout": 3600,
            "cleanup_old_deployments": True,
            "max_concurrent_deployments": 10
        }
        
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
        except Exception as e:
            logger.warning(f"Could not load config from {config_path}: {e}")
        
        return default_config
    
    def init_database(self):
        """Initialize SQLite database for device management"""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT UNIQUE NOT NULL,
                    mac_address TEXT UNIQUE NOT NULL,
                    ip_address TEXT,
                    hostname TEXT,
                    hardware_profile TEXT,
                    current_image TEXT,
                    target_image TEXT,
                    status TEXT DEFAULT 'registered',
                    location TEXT,
                    assigned_user TEXT,
                    last_seen TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS deployments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    deployment_id TEXT UNIQUE NOT NULL,
                    device_id TEXT NOT NULL,
                    image_id TEXT NOT NULL,
                    deployment_method TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    progress INTEGER DEFAULT 0,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    error_message TEXT,
                    FOREIGN KEY (device_id) REFERENCES devices (device_id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_id TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    version TEXT NOT NULL,
                    description TEXT,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    sha256_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            ''')
            
            # Create indexes for better performance
            conn.execute('CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices (mac_address)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (status)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_deployments_device ON deployments (device_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments (status)')
            
            conn.commit()
    
    def register_device(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new thin client device"""
        try:
            device_id = device_info.get('device_id') or self.generate_device_id(device_info['mac_address'])
            mac_address = device_info['mac_address'].lower().replace('-', ':')
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO devices 
                    (device_id, mac_address, ip_address, hostname, hardware_profile, 
                     location, assigned_user, last_seen, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    device_id,
                    mac_address,
                    device_info.get('ip_address'),
                    device_info.get('hostname'),
                    json.dumps(device_info.get('hardware_profile', {})),
                    device_info.get('location'),
                    device_info.get('assigned_user'),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
                conn.commit()
            
            # Create DHCP reservation
            self.create_dhcp_reservation(mac_address, device_info.get('ip_address'))
            
            logger.info(f"Device registered: {device_id} ({mac_address})")
            return {
                "success": True,
                "device_id": device_id,
                "mac_address": mac_address
            }
            
        except Exception as e:
            logger.error(f"Failed to register device: {e}")
            return {"success": False, "error": str(e)}
    
    def generate_device_id(self, mac_address: str) -> str:
        """Generate device ID from MAC address"""
        return mac_address.replace(':', '').lower()
    
    def create_dhcp_reservation(self, mac_address: str, ip_address: Optional[str] = None):
        """Create DHCP reservation for device"""
        if not ip_address:
            return
        
        reservations_file = "/etc/dnsmasq.d/vdi-devices.conf"
        
        # Check if reservation already exists
        reservation_line = f"dhcp-host={mac_address},{ip_address},24h"
        
        try:
            if os.path.exists(reservations_file):
                with open(reservations_file, 'r') as f:
                    content = f.read()
                    if mac_address in content:
                        # Update existing reservation
                        lines = content.split('\n')
                        updated_lines = []
                        for line in lines:
                            if mac_address in line:
                                updated_lines.append(reservation_line)
                            else:
                                updated_lines.append(line)
                        content = '\n'.join(updated_lines)
                    else:
                        # Add new reservation
                        content += f"\n{reservation_line}"
            else:
                content = reservation_line
            
            os.makedirs(os.path.dirname(reservations_file), exist_ok=True)
            with open(reservations_file, 'w') as f:
                f.write(content)
            
            # Restart dnsmasq to apply changes
            os.system("systemctl restart dnsmasq 2>/dev/null || service dnsmasq restart 2>/dev/null || rc-service dnsmasq restart")
            
        except Exception as e:
            logger.warning(f"Could not create DHCP reservation: {e}")
    
    def deploy_image_to_device(self, device_id: str, image_id: str, deployment_method: str = 'pxe') -> Dict[str, Any]:
        """Deploy image to specific device"""
        try:
            # Get device information
            device = self.get_device(device_id)
            if not device:
                return {"success": False, "error": "Device not found"}
            
            # Get image information
            image = self.get_image(image_id)
            if not image:
                return {"success": False, "error": "Image not found"}
            
            # Generate deployment ID
            deployment_id = f"deploy-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{device_id[:8]}"
            
            # Record deployment in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO deployments 
                    (deployment_id, device_id, image_id, deployment_method, status)
                    VALUES (?, ?, ?, ?, ?)
                ''', (deployment_id, device_id, image_id, deployment_method, 'pending'))
                conn.commit()
            
            # Execute deployment based on method
            if deployment_method == 'pxe':
                result = self.deploy_via_pxe(device, image, deployment_id)
            elif deployment_method == 'usb':
                result = self.deploy_via_usb(device, image, deployment_id)
            elif deployment_method == 'network':
                result = self.deploy_via_network(device, image, deployment_id)
            else:
                result = {"success": False, "error": f"Unsupported deployment method: {deployment_method}"}
            
            # Update deployment status
            status = 'deploying' if result['success'] else 'failed'
            error_message = result.get('error') if not result['success'] else None
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    UPDATE deployments 
                    SET status = ?, error_message = ?, started_at = ?
                    WHERE deployment_id = ?
                ''', (status, error_message, datetime.now().isoformat(), deployment_id))
                conn.commit()
            
            result['deployment_id'] = deployment_id
            return result
            
        except Exception as e:
            logger.error(f"Deployment failed: {e}")
            return {"success": False, "error": str(e)}
    
    def deploy_via_pxe(self, device: Dict, image: Dict, deployment_id: str) -> Dict[str, Any]:
        """Deploy image using PXE boot"""
        try:
            mac_address = device['mac_address']
            image_path = image['file_path']
            
            # Copy image to HTTP directory if not already there
            image_name = Path(image_path).name
            http_image_path = self.http_root / image_name
            
            if not http_image_path.exists():
                shutil.copy2(image_path, http_image_path)
                logger.info(f"Copied image to HTTP directory: {http_image_path}")
            
            # Create device-specific PXE configuration
            mac_config = mac_address.replace(':', '-').lower()
            pxe_config_file = self.tftp_root / "pxelinux.cfg" / f"01-{mac_config}"
            
            pxe_config = f"""DEFAULT vdi-deploy
LABEL vdi-deploy
    KERNEL images/deploy/vmlinuz
    APPEND initrd=images/deploy/initrd.img boot=live fetch=http://{self.config['pxe_server_ip']}/images/{image_name} quiet splash deployment_id={deployment_id}
"""
            
            pxe_config_file.parent.mkdir(parents=True, exist_ok=True)
            pxe_config_file.write_text(pxe_config)
            
            logger.info(f"Created PXE config for device {device['device_id']}: {pxe_config_file}")
            
            return {
                "success": True,
                "method": "pxe",
                "pxe_config": str(pxe_config_file),
                "image_url": f"http://{self.config['pxe_server_ip']}/images/{image_name}"
            }
            
        except Exception as e:
            logger.error(f"PXE deployment failed: {e}")
            return {"success": False, "error": str(e)}
    
    def deploy_via_usb(self, device: Dict, image: Dict, deployment_id: str) -> Dict[str, Any]:
        """Deploy image via USB (preparation only)"""
        try:
            image_path = image['file_path']
            
            # Create USB deployment package
            usb_package_dir = Path(f"/tmp/usb-deploy-{deployment_id}")
            usb_package_dir.mkdir(exist_ok=True)
            
            # Copy image
            shutil.copy2(image_path, usb_package_dir / "vdi-image.img")
            
            # Create deployment script
            deploy_script = f"""#!/bin/bash
# USB Deployment Script for {device['device_id']}
# Generated: {datetime.now().isoformat()}

DEVICE_ID="{device['device_id']}"
DEPLOYMENT_ID="{deployment_id}"
IMAGE_FILE="vdi-image.img"

echo "Starting USB deployment for device $DEVICE_ID"
echo "Deployment ID: $DEPLOYMENT_ID"

# Mount target device (assuming /dev/sda)
TARGET_DEVICE="/dev/sda"

echo "WARNING: This will erase all data on $TARGET_DEVICE"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Write image to device
echo "Writing image to $TARGET_DEVICE..."
dd if="$IMAGE_FILE" of="$TARGET_DEVICE" bs=4M status=progress

echo "Deployment completed successfully"
echo "Remove USB device and reboot to boot from installed image"
"""
            
            (usb_package_dir / "deploy.sh").write_text(deploy_script)
            (usb_package_dir / "deploy.sh").chmod(0o755)
            
            # Create info file
            info = {
                "device_id": device['device_id'],
                "deployment_id": deployment_id,
                "image_name": image['name'],
                "image_version": image['version'],
                "created_at": datetime.now().isoformat()
            }
            
            (usb_package_dir / "deployment-info.json").write_text(json.dumps(info, indent=2))
            
            return {
                "success": True,
                "method": "usb",
                "package_directory": str(usb_package_dir),
                "instructions": "Copy package contents to USB drive and run deploy.sh on target device"
            }
            
        except Exception as e:
            logger.error(f"USB deployment preparation failed: {e}")
            return {"success": False, "error": str(e)}
    
    def deploy_via_network(self, device: Dict, image: Dict, deployment_id: str) -> Dict[str, Any]:
        """Deploy image via network push (requires agent)"""
        try:
            image_url = f"http://{self.config['pxe_server_ip']}/images/{Path(image['file_path']).name}"
            image_hash = image.get('sha256_hash', '')
            
            # This would send a command to the device agent
            # For now, we'll just return the deployment information
            
            return {
                "success": True,
                "method": "network",
                "image_url": image_url,
                "image_hash": image_hash,
                "instructions": "Network deployment requires VDI agent on target device"
            }
            
        except Exception as e:
            logger.error(f"Network deployment failed: {e}")
            return {"success": False, "error": str(e)}
    
    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get device information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    'SELECT * FROM devices WHERE device_id = ?',
                    (device_id,)
                )
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get device: {e}")
            return None
    
    def get_image(self, image_id: str) -> Optional[Dict[str, Any]]:
        """Get image information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    'SELECT * FROM images WHERE image_id = ?',
                    (image_id,)
                )
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get image: {e}")
            return None
    
    def register_image(self, image_path: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new image in the system"""
        try:
            image_path = Path(image_path)
            if not image_path.exists():
                return {"success": False, "error": "Image file does not exist"}
            
            # Calculate file hash
            sha256_hash = hashlib.sha256()
            with open(image_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            file_hash = sha256_hash.hexdigest()
            
            # Generate image ID
            image_id = f"{metadata.get('name', 'unknown')}-{metadata.get('version', '1.0')}-{file_hash[:8]}"
            
            # Copy image to HTTP directory
            target_path = self.http_root / image_path.name
            if not target_path.exists():
                shutil.copy2(image_path, target_path)
            
            # Register in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO images 
                    (image_id, name, version, description, file_path, file_size, sha256_hash, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    image_id,
                    metadata.get('name', 'Unknown'),
                    metadata.get('version', '1.0'),
                    metadata.get('description', ''),
                    str(target_path),
                    image_path.stat().st_size,
                    file_hash,
                    json.dumps(metadata)
                ))
                conn.commit()
            
            logger.info(f"Image registered: {image_id}")
            return {
                "success": True,
                "image_id": image_id,
                "file_path": str(target_path),
                "sha256_hash": file_hash
            }
            
        except Exception as e:
            logger.error(f"Failed to register image: {e}")
            return {"success": False, "error": str(e)}
    
    def list_devices(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all registered devices"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                if status:
                    cursor = conn.execute(
                        'SELECT * FROM devices WHERE status = ? ORDER BY created_at DESC',
                        (status,)
                    )
                else:
                    cursor = conn.execute(
                        'SELECT * FROM devices ORDER BY created_at DESC'
                    )
                
                return [dict(row) for row in cursor.fetchall()]
                
        except Exception as e:
            logger.error(f"Failed to list devices: {e}")
            return []
    
    def list_deployments(self, device_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List deployments"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                query = 'SELECT * FROM deployments'
                params = []
                conditions = []
                
                if device_id:
                    conditions.append('device_id = ?')
                    params.append(device_id)
                
                if status:
                    conditions.append('status = ?')
                    params.append(status)
                
                if conditions:
                    query += ' WHERE ' + ' AND '.join(conditions)
                
                query += ' ORDER BY started_at DESC'
                
                cursor = conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
                
        except Exception as e:
            logger.error(f"Failed to list deployments: {e}")
            return []
    
    def cleanup_deployment(self, device_id: str) -> bool:
        """Clean up deployment files for a device"""
        try:
            device = self.get_device(device_id)
            if not device:
                return False
            
            mac_address = device['mac_address']
            mac_config = mac_address.replace(':', '-').lower()
            pxe_config_file = self.tftp_root / "pxelinux.cfg" / f"01-{mac_config}"
            
            if pxe_config_file.exists():
                pxe_config_file.unlink()
                logger.info(f"Removed PXE config for device {device_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to cleanup deployment: {e}")
            return False


def main():
    """Command line interface for device manager"""
    import argparse
    
    parser = argparse.ArgumentParser(description='VDI Thin Client Device Manager')
    parser.add_argument('command', choices=['register', 'deploy', 'list', 'cleanup', 'register-image'])
    parser.add_argument('--device-id', help='Device ID')
    parser.add_argument('--mac-address', help='Device MAC address')
    parser.add_argument('--ip-address', help='Device IP address')
    parser.add_argument('--hostname', help='Device hostname')
    parser.add_argument('--image-id', help='Image ID for deployment')
    parser.add_argument('--image-path', help='Path to image file')
    parser.add_argument('--method', choices=['pxe', 'usb', 'network'], default='pxe', help='Deployment method')
    parser.add_argument('--status', help='Filter by status')
    parser.add_argument('--metadata', help='JSON metadata for image registration')
    
    args = parser.parse_args()
    
    manager = DeviceManager()
    
    if args.command == 'register':
        if not args.mac_address:
            print("ERROR: MAC address is required for device registration")
            sys.exit(1)
        
        device_info = {
            'mac_address': args.mac_address,
            'ip_address': args.ip_address,
            'hostname': args.hostname,
            'device_id': args.device_id
        }
        
        result = manager.register_device(device_info)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'deploy':
        if not args.device_id or not args.image_id:
            print("ERROR: Device ID and Image ID are required for deployment")
            sys.exit(1)
        
        result = manager.deploy_image_to_device(args.device_id, args.image_id, args.method)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'list':
        if args.device_id:
            # List deployments for specific device
            deployments = manager.list_deployments(device_id=args.device_id, status=args.status)
            print(json.dumps(deployments, indent=2))
        else:
            # List devices
            devices = manager.list_devices(status=args.status)
            print(json.dumps(devices, indent=2))
    
    elif args.command == 'cleanup':
        if not args.device_id:
            print("ERROR: Device ID is required for cleanup")
            sys.exit(1)
        
        success = manager.cleanup_deployment(args.device_id)
        print(json.dumps({"success": success}))
    
    elif args.command == 'register-image':
        if not args.image_path:
            print("ERROR: Image path is required for image registration")
            sys.exit(1)
        
        metadata = {}
        if args.metadata:
            try:
                metadata = json.loads(args.metadata)
            except json.JSONDecodeError:
                print("ERROR: Invalid JSON metadata")
                sys.exit(1)
        
        result = manager.register_image(args.image_path, metadata)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()