#!/usr/bin/env python3
"""
Alpine Linux Thin Client Image Builder
Automated image creation with hardware optimization and VDI integration
"""

import os
import sys
import json
import shutil
import hashlib
import tempfile
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AlpineImageBuilder:
    """Main class for building customized Alpine Linux thin client images"""
    
    def __init__(self, config_path: str = "/etc/vdi/image-builder.conf"):
        self.config = self.load_config(config_path)
        self.work_dir = Path(self.config.get("work_directory", "/tmp/alpine-build"))
        self.output_dir = Path(self.config.get("output_directory", "/var/lib/vdi/images"))
        self.alpine_mirror = self.config.get("alpine_mirror", "https://dl-cdn.alpinelinux.org/alpine")
        
        # Ensure directories exist
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load config from {config_path}: {e}")
        
        # Default configuration
        return {
            "alpine_version": "3.19",
            "architecture": "x86_64",
            "work_directory": "/tmp/alpine-build",
            "output_directory": "/var/lib/vdi/images",
            "alpine_mirror": "https://dl-cdn.alpinelinux.org/alpine",
            "default_packages": [
                "alpine-base", "linux-lts", "linux-firmware", "eudev",
                "chrony", "openssh", "curl", "bash", "python3", "py3-pip",
                "networkmanager", "wpa_supplicant", "dhcpcd",
                "freerdp", "remmina", "pulseaudio", "alsa-utils",
                "xorg-server", "xf86-video-intel", "xf86-video-amdgpu",
                "htop", "nano", "wget", "rsync"
            ]
        }
    
    def create_custom_image(self, image_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Create a customized Alpine Linux image based on specifications"""
        build_id = f"alpine-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        build_path = self.work_dir / build_id
        
        logger.info(f"Starting image build: {build_id}")
        
        try:
            # Create build environment
            build_path.mkdir(parents=True, exist_ok=True)
            
            # Download and extract base Alpine image
            self.extract_base_image(build_path, image_spec)
            
            # Install packages
            self.install_packages(build_path, image_spec.get("packages", []))
            
            # Configure system
            self.configure_system(build_path, image_spec.get("system_config", {}))
            
            # Install hardware drivers
            self.install_hardware_drivers(build_path, image_spec.get("drivers", []))
            
            # Configure VDI components
            self.configure_vdi_components(build_path, image_spec.get("vdi_config", {}))
            
            # Apply customizations
            self.apply_customizations(build_path, image_spec.get("customizations", {}))
            
            # Optimize for boot performance
            self.optimize_boot_performance(build_path)
            
            # Create bootable image
            image_path = self.create_bootable_image(build_path, image_spec, build_id)
            
            # Generate metadata
            metadata = self.generate_image_metadata(image_path, image_spec, build_id)
            
            logger.info(f"Image build completed: {image_path}")
            
            return {
                "success": True,
                "build_id": build_id,
                "image_path": str(image_path),
                "metadata": metadata,
                "size_mb": round(os.path.getsize(image_path) / (1024 * 1024), 2)
            }
            
        except Exception as e:
            logger.error(f"Image build failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "build_id": build_id
            }
        finally:
            # Cleanup build directory
            if build_path.exists():
                shutil.rmtree(build_path)
    
    def extract_base_image(self, build_path: Path, image_spec: Dict[str, Any]):
        """Download and extract Alpine Linux base image"""
        alpine_version = image_spec.get("alpine_version", self.config["alpine_version"])
        architecture = image_spec.get("architecture", self.config["architecture"])
        
        base_image_url = f"{self.alpine_mirror}/v{alpine_version}/releases/{architecture}/alpine-minirootfs-{alpine_version}.0-{architecture}.tar.gz"
        base_image_path = build_path / "alpine-minirootfs.tar.gz"
        
        logger.info(f"Downloading Alpine base image: {base_image_url}")
        
        # Download base image
        subprocess.run([
            "wget", "-O", str(base_image_path), base_image_url
        ], check=True)
        
        # Extract to rootfs directory
        rootfs_path = build_path / "rootfs"
        rootfs_path.mkdir(exist_ok=True)
        
        subprocess.run([
            "tar", "-xzf", str(base_image_path), "-C", str(rootfs_path)
        ], check=True)
        
        logger.info("Base image extracted successfully")
    
    def install_packages(self, build_path: Path, additional_packages: List[str]):
        """Install Alpine packages using apk in chroot"""
        rootfs_path = build_path / "rootfs"
        
        # Prepare package list
        packages = self.config["default_packages"] + additional_packages
        packages = list(set(packages))  # Remove duplicates
        
        logger.info(f"Installing {len(packages)} packages")
        
        # Setup package installation script
        install_script = f"""#!/bin/sh
set -e

# Setup Alpine repositories
echo '{self.alpine_mirror}/v{self.config["alpine_version"]}/main' > /etc/apk/repositories
echo '{self.alpine_mirror}/v{self.config["alpine_version"]}/community' >> /etc/apk/repositories

# Update package index
apk update

# Install packages
apk add {' '.join(packages)}

# Clean up package cache
apk cache clean
"""
        
        script_path = rootfs_path / "install_packages.sh"
        script_path.write_text(install_script)
        script_path.chmod(0o755)
        
        # Execute in chroot
        self.run_in_chroot(rootfs_path, "/install_packages.sh")
        script_path.unlink()  # Remove script
    
    def configure_system(self, build_path: Path, system_config: Dict[str, Any]):
        """Configure system settings and services"""
        rootfs_path = build_path / "rootfs"
        
        logger.info("Configuring system settings")
        
        # Configure hostname
        hostname = system_config.get("hostname", "vdi-client")
        (rootfs_path / "etc" / "hostname").write_text(f"{hostname}\n")
        
        # Configure timezone
        timezone = system_config.get("timezone", "UTC")
        self.run_in_chroot(rootfs_path, f"setup-timezone -z {timezone}")
        
        # Configure network
        self.configure_networking(rootfs_path, system_config.get("network", {}))
        
        # Configure SSH
        self.configure_ssh(rootfs_path, system_config.get("ssh", {}))
        
        # Configure users
        self.configure_users(rootfs_path, system_config.get("users", {}))
        
        # Enable services
        services = system_config.get("services", ["networkmanager", "chronyd", "sshd"])
        for service in services:
            self.run_in_chroot(rootfs_path, f"rc-update add {service} default")
    
    def configure_networking(self, rootfs_path: Path, network_config: Dict[str, Any]):
        """Configure network settings"""
        
        # NetworkManager configuration
        nm_config = """[main]
plugins=keyfile

[keyfile]
unmanaged-devices=none

[device]
wifi.scan-rand-mac-address=no
"""
        
        nm_config_dir = rootfs_path / "etc" / "NetworkManager"
        nm_config_dir.mkdir(parents=True, exist_ok=True)
        (nm_config_dir / "NetworkManager.conf").write_text(nm_config)
        
        # Configure wireless if specified
        if "wifi" in network_config:
            wifi_config = network_config["wifi"]
            wpa_config = f"""network={{
    ssid="{wifi_config.get('ssid', '')}"
    psk="{wifi_config.get('password', '')}"
    key_mgmt={wifi_config.get('security', 'WPA-PSK')}
}}
"""
            (rootfs_path / "etc" / "wpa_supplicant" / "wpa_supplicant.conf").write_text(wpa_config)
    
    def configure_ssh(self, rootfs_path: Path, ssh_config: Dict[str, Any]):
        """Configure SSH server"""
        if not ssh_config.get("enabled", True):
            return
        
        sshd_config = f"""# VDI Thin Client SSH Configuration
Port {ssh_config.get('port', 22)}
PermitRootLogin {ssh_config.get('permit_root', 'no')}
PasswordAuthentication {ssh_config.get('password_auth', 'yes')}
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
"""
        
        (rootfs_path / "etc" / "ssh" / "sshd_config").write_text(sshd_config)
    
    def configure_users(self, rootfs_path: Path, users_config: Dict[str, Any]):
        """Configure system users"""
        # Create VDI user
        vdi_user = users_config.get("vdi_user", {"username": "vdi-user", "password": "vdi123"})
        username = vdi_user["username"]
        password = vdi_user["password"]
        
        # Create user with home directory
        self.run_in_chroot(rootfs_path, f"adduser -D -s /bin/bash {username}")
        self.run_in_chroot(rootfs_path, f"echo '{username}:{password}' | chpasswd")
        
        # Add to necessary groups
        groups = ["wheel", "audio", "video", "netdev"]
        for group in groups:
            self.run_in_chroot(rootfs_path, f"addgroup {username} {group}")
    
    def configure_vdi_components(self, build_path: Path, vdi_config: Dict[str, Any]):
        """Configure VDI-specific components"""
        rootfs_path = build_path / "rootfs"
        
        logger.info("Configuring VDI components")
        
        # Create VDI directories
        vdi_dirs = [
            "etc/vdi",
            "usr/local/bin",
            "var/lib/vdi",
            "var/log/vdi"
        ]
        
        for dir_path in vdi_dirs:
            (rootfs_path / dir_path).mkdir(parents=True, exist_ok=True)
        
        # Configure RDP client defaults
        rdp_config = {
            "server": vdi_config.get("rdp_server", ""),
            "domain": vdi_config.get("domain", ""),
            "color_depth": vdi_config.get("color_depth", 32),
            "audio_mode": vdi_config.get("audio_mode", "local"),
            "drive_redirection": vdi_config.get("drive_redirection", True),
            "clipboard": vdi_config.get("clipboard", True)
        }
        
        (rootfs_path / "etc" / "vdi" / "rdp-config.json").write_text(
            json.dumps(rdp_config, indent=2)
        )
        
        # Install VDI management agent (will be created next)
        self.install_vdi_agent(rootfs_path, vdi_config)
    
    def install_vdi_agent(self, rootfs_path: Path, vdi_config: Dict[str, Any]):
        """Install VDI management agent"""
        
        # Create init script for VDI agent
        agent_init_script = """#!/sbin/openrc-run

name="vdi-agent"
description="VDI Client Management Agent"
command="/usr/local/bin/vdi-agent"
pidfile="/var/run/vdi-agent.pid"
command_background="yes"

depend() {
    need net
    after networkmanager
}

start_pre() {
    checkpath --directory --owner root:root --mode 0755 /var/run
    checkpath --directory --owner root:root --mode 0755 /var/log/vdi
}
"""
        
        (rootfs_path / "etc" / "init.d" / "vdi-agent").write_text(agent_init_script)
        (rootfs_path / "etc" / "init.d" / "vdi-agent").chmod(0o755)
        
        # Enable the service
        self.run_in_chroot(rootfs_path, "rc-update add vdi-agent default")
    
    def install_hardware_drivers(self, build_path: Path, driver_specs: List[Dict[str, Any]]):
        """Install hardware-specific drivers"""
        rootfs_path = build_path / "rootfs"
        
        logger.info(f"Installing {len(driver_specs)} driver packages")
        
        for driver_spec in driver_specs:
            driver_type = driver_spec.get("type")
            
            if driver_type == "network":
                self.install_network_drivers(rootfs_path, driver_spec)
            elif driver_type == "graphics":
                self.install_graphics_drivers(rootfs_path, driver_spec)
            elif driver_type == "audio":
                self.install_audio_drivers(rootfs_path, driver_spec)
    
    def install_network_drivers(self, rootfs_path: Path, driver_spec: Dict[str, Any]):
        """Install network drivers"""
        drivers = driver_spec.get("drivers", [])
        
        # Install wireless firmware if needed
        if "wireless" in drivers:
            self.run_in_chroot(rootfs_path, "apk add linux-firmware-ath9k_htc linux-firmware-ath10k linux-firmware-iwlwifi")
    
    def install_graphics_drivers(self, rootfs_path: Path, driver_spec: Dict[str, Any]):
        """Install graphics drivers"""
        drivers = driver_spec.get("drivers", [])
        
        driver_packages = []
        if "intel" in drivers:
            driver_packages.append("xf86-video-intel")
        if "amd" in drivers:
            driver_packages.append("xf86-video-amdgpu")
        if "nvidia" in drivers:
            driver_packages.append("xf86-video-nouveau")
        
        if driver_packages:
            self.run_in_chroot(rootfs_path, f"apk add {' '.join(driver_packages)}")
    
    def install_audio_drivers(self, rootfs_path: Path, driver_spec: Dict[str, Any]):
        """Install audio drivers"""
        # Audio drivers are typically included in the base system
        self.run_in_chroot(rootfs_path, "apk add alsa-utils pulseaudio pulseaudio-alsa")
    
    def optimize_boot_performance(self, build_path: Path):
        """Optimize system for fast boot times"""
        rootfs_path = build_path / "rootfs"
        
        logger.info("Optimizing boot performance")
        
        # Create fast boot script
        boot_script = """#!/bin/sh
# VDI Thin Client Fast Boot Script

# Set hostname from DHCP or generate from MAC
if [ -z "$HOSTNAME" ]; then
    MAC=$(cat /sys/class/net/*/address | head -1 | tr -d ':')
    HOSTNAME="vdi-client-$MAC"
    hostname "$HOSTNAME"
    echo "$HOSTNAME" > /etc/hostname
fi

# Start VDI management agent
/usr/local/bin/vdi-agent &

# Auto-connect to RDP if configured
if [ -f /etc/vdi/autoconnect.conf ]; then
    /usr/local/bin/vdi-autoconnect &
fi

# Configure X11 for optimal RDP performance
if [ ! -f /etc/X11/xorg.conf.d/99-vdi.conf ]; then
    mkdir -p /etc/X11/xorg.conf.d
    cat > /etc/X11/xorg.conf.d/99-vdi.conf << 'XEOF'
Section "Device"
    Identifier "VDI Graphics"
    Driver "modesetting"
    Option "AccelMethod" "glamor"
    Option "DRI" "3"
EndSection

Section "Screen"
    Identifier "VDI Screen"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "1920x1080" "1680x1050" "1440x900" "1024x768"
    EndSubSection
EndSection
XEOF
fi
"""
        
        startup_script_path = rootfs_path / "etc" / "local.d" / "vdi-startup.start"
        startup_script_path.parent.mkdir(parents=True, exist_ok=True)
        startup_script_path.write_text(boot_script)
        startup_script_path.chmod(0o755)
        
        # Enable local service
        self.run_in_chroot(rootfs_path, "rc-update add local default")
    
    def apply_customizations(self, build_path: Path, customizations: Dict[str, Any]):
        """Apply custom configurations"""
        rootfs_path = build_path / "rootfs"
        
        logger.info("Applying customizations")
        
        # Custom files
        if "files" in customizations:
            for file_spec in customizations["files"]:
                dest_path = rootfs_path / file_spec["path"].lstrip("/")
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                dest_path.write_text(file_spec["content"])
                dest_path.chmod(file_spec.get("mode", 0o644))
        
        # Custom scripts
        if "scripts" in customizations:
            for script in customizations["scripts"]:
                script_path = rootfs_path / "tmp" / "custom_script.sh"
                script_path.write_text(script)
                script_path.chmod(0o755)
                self.run_in_chroot(rootfs_path, "/tmp/custom_script.sh")
                script_path.unlink()
    
    def create_bootable_image(self, build_path: Path, image_spec: Dict[str, Any], build_id: str) -> Path:
        """Create bootable image file"""
        rootfs_path = build_path / "rootfs"
        image_name = image_spec.get("name", "vdi-client")
        version = image_spec.get("version", "1.0")
        
        output_path = self.output_dir / f"{image_name}-{version}-{build_id}.img"
        
        logger.info(f"Creating bootable image: {output_path}")
        
        # Create filesystem image
        subprocess.run([
            "mksquashfs", str(rootfs_path), str(output_path),
            "-comp", "xz", "-Xbcj", "x86", "-b", "1M", "-no-xattrs"
        ], check=True)
        
        return output_path
    
    def generate_image_metadata(self, image_path: Path, image_spec: Dict[str, Any], build_id: str) -> Dict[str, Any]:
        """Generate image metadata"""
        
        # Calculate file hash
        sha256_hash = hashlib.sha256()
        with open(image_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        
        metadata = {
            "build_id": build_id,
            "name": image_spec.get("name", "vdi-client"),
            "version": image_spec.get("version", "1.0"),
            "description": image_spec.get("description", "VDI Thin Client Image"),
            "alpine_version": image_spec.get("alpine_version", self.config["alpine_version"]),
            "architecture": image_spec.get("architecture", self.config["architecture"]),
            "created_at": datetime.now().isoformat(),
            "file_size": os.path.getsize(image_path),
            "sha256": sha256_hash.hexdigest(),
            "packages": self.config["default_packages"] + image_spec.get("packages", []),
            "drivers": image_spec.get("drivers", []),
            "vdi_config": image_spec.get("vdi_config", {})
        }
        
        # Save metadata file
        metadata_path = image_path.with_suffix('.json')
        metadata_path.write_text(json.dumps(metadata, indent=2))
        
        return metadata
    
    def run_in_chroot(self, rootfs_path: Path, command: str):
        """Execute command in chroot environment"""
        subprocess.run([
            "chroot", str(rootfs_path), "sh", "-c", command
        ], check=True)


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: alpine_image_builder.py <image_spec.json>")
        sys.exit(1)
    
    spec_file = sys.argv[1]
    
    try:
        with open(spec_file, 'r') as f:
            image_spec = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load image specification: {e}")
        sys.exit(1)
    
    builder = AlpineImageBuilder()
    result = builder.create_custom_image(image_spec)
    
    if result["success"]:
        print(f"Image build successful!")
        print(f"Build ID: {result['build_id']}")
        print(f"Image Path: {result['image_path']}")
        print(f"Size: {result['size_mb']} MB")
    else:
        print(f"Image build failed: {result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()