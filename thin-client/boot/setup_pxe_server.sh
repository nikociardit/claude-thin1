#!/bin/bash
# PXE Boot Server Setup Script
# Sets up DHCP, TFTP, and HTTP services for thin client deployment

set -e

# Configuration variables
TFTP_ROOT="/var/lib/tftpboot"
HTTP_ROOT="/var/www/html/images"
DHCP_CONFIG="/etc/dhcp/dhcpd.conf"
DNSMASQ_CONFIG="/etc/dnsmasq.conf"
PXE_SUBNET="192.168.100.0"
PXE_NETMASK="255.255.255.0"
PXE_RANGE_START="192.168.100.100"
PXE_RANGE_END="192.168.100.200"
PXE_SERVER_IP="192.168.100.1"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

install_packages() {
    log "Installing required packages..."
    
    if command -v apk &> /dev/null; then
        # Alpine Linux
        apk update
        apk add --no-cache dnsmasq tftp-hpa nginx syslinux
    elif command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y dnsmasq tftpd-hpa nginx-light syslinux-common pxelinux
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        yum install -y dnsmasq tftp-server nginx syslinux
    else
        log "ERROR: Unsupported package manager"
        exit 1
    fi
}

setup_directories() {
    log "Setting up directory structure..."
    
    # Create TFTP directories
    mkdir -p "$TFTP_ROOT"/{pxelinux.cfg,images,firmware}
    
    # Create HTTP directories
    mkdir -p "$HTTP_ROOT"
    
    # Set permissions
    chmod -R 755 "$TFTP_ROOT"
    chmod -R 755 "$HTTP_ROOT"
    chown -R root:root "$TFTP_ROOT"
    chown -R nginx:nginx "$HTTP_ROOT" 2>/dev/null || chown -R www-data:www-data "$HTTP_ROOT" 2>/dev/null || true
}

configure_dnsmasq() {
    log "Configuring dnsmasq for DHCP and TFTP..."
    
    cat > "$DNSMASQ_CONFIG" << EOF
# VDI Thin Client PXE Configuration
interface=eth0
bind-interfaces

# DHCP Configuration
dhcp-range=$PXE_RANGE_START,$PXE_RANGE_END,12h
dhcp-option=3,$PXE_SERVER_IP
dhcp-option=6,8.8.8.8,8.8.4.4

# PXE Boot Configuration
dhcp-boot=pxelinux.0,$PXE_SERVER_IP
dhcp-option=66,$PXE_SERVER_IP

# TFTP Configuration
enable-tftp
tftp-root=$TFTP_ROOT
tftp-secure

# DNS Configuration  
server=8.8.8.8
server=8.8.4.4
cache-size=1000

# Logging
log-queries
log-dhcp
log-facility=/var/log/dnsmasq.log

# Domain configuration
domain=vdi.local
local=/vdi.local/
EOF
}

setup_pxe_boot_files() {
    log "Setting up PXE boot files..."
    
    # Find syslinux files
    SYSLINUX_PATH=""
    if [ -d "/usr/share/syslinux" ]; then
        SYSLINUX_PATH="/usr/share/syslinux"
    elif [ -d "/usr/lib/syslinux" ]; then
        SYSLINUX_PATH="/usr/lib/syslinux"
    elif [ -d "/usr/lib/PXELINUX" ]; then
        SYSLINUX_PATH="/usr/lib/PXELINUX"
    else
        log "ERROR: Could not find syslinux files"
        exit 1
    fi
    
    # Copy PXE boot files
    cp "$SYSLINUX_PATH/pxelinux.0" "$TFTP_ROOT/"
    cp "$SYSLINUX_PATH/menu.c32" "$TFTP_ROOT/" 2>/dev/null || true
    cp "$SYSLINUX_PATH/ldlinux.c32" "$TFTP_ROOT/" 2>/dev/null || true
    cp "$SYSLINUX_PATH/libcom32.c32" "$TFTP_ROOT/" 2>/dev/null || true
    cp "$SYSLINUX_PATH/libutil.c32" "$TFTP_ROOT/" 2>/dev/null || true
    
    # Create default PXE menu
    cat > "$TFTP_ROOT/pxelinux.cfg/default" << EOF
DEFAULT menu.c32
PROMPT 0
TIMEOUT 100
MENU TITLE VDI Thin Client Boot Menu
MENU BACKGROUND vdi-background.png

LABEL local
    MENU LABEL ^1) Boot from local disk
    MENU DEFAULT
    LOCALBOOT 0

LABEL deploy
    MENU LABEL ^2) Deploy VDI Image
    KERNEL images/deploy/vmlinuz
    APPEND initrd=images/deploy/initrd.img boot=live fetch=http://$PXE_SERVER_IP/images/deploy/filesystem.squashfs quiet splash

LABEL rescue
    MENU LABEL ^3) Rescue Mode
    KERNEL images/rescue/vmlinuz
    APPEND initrd=images/rescue/initrd.img boot=live toram

LABEL memtest
    MENU LABEL ^4) Memory Test
    KERNEL images/memtest86+.bin

MENU SEPARATOR

LABEL reboot
    MENU LABEL ^R) Reboot
    TEXT HELP
    Restart the computer
    ENDTEXT
    COM32 reboot.c32

LABEL poweroff
    MENU LABEL ^P) Power Off
    TEXT HELP
    Shut down the computer
    ENDTEXT
    COM32 poweroff.c32
EOF

    # Create device-specific configs directory
    mkdir -p "$TFTP_ROOT/pxelinux.cfg/devices"
}

configure_nginx() {
    log "Configuring Nginx for image serving..."
    
    # Create Nginx configuration
    cat > "/etc/nginx/conf.d/vdi-pxe.conf" << EOF
server {
    listen 80;
    server_name $PXE_SERVER_IP;
    root $HTTP_ROOT;
    
    location / {
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
    
    location ~ \\.img\$ {
        add_header Content-Type application/octet-stream;
        add_header Content-Disposition 'attachment';
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    access_log /var/log/nginx/vdi-pxe-access.log;
    error_log /var/log/nginx/vdi-pxe-error.log;
}
EOF

    # Test Nginx configuration
    nginx -t
}

create_deployment_scripts() {
    log "Creating deployment management scripts..."
    
    # Create image deployment script
    cat > "/usr/local/bin/vdi-deploy-image" << 'EOF'
#!/bin/bash
# VDI Image Deployment Script

IMAGE_PATH="$1"
DEVICE_MAC="$2"
DEPLOYMENT_ID="$3"

if [ $# -lt 3 ]; then
    echo "Usage: $0 <image_path> <device_mac> <deployment_id>"
    exit 1
fi

TFTP_ROOT="/var/lib/tftpboot"
HTTP_ROOT="/var/www/html/images"

# Create device-specific PXE config
MAC_CONFIG=$(echo "$DEVICE_MAC" | tr ':' '-' | tr '[:upper:]' '[:lower:]')
PXE_CONFIG_FILE="$TFTP_ROOT/pxelinux.cfg/01-$MAC_CONFIG"

# Copy image to HTTP directory
IMAGE_NAME=$(basename "$IMAGE_PATH")
cp "$IMAGE_PATH" "$HTTP_ROOT/$IMAGE_NAME"

# Create PXE boot config for this device
cat > "$PXE_CONFIG_FILE" << PXEEOF
DEFAULT vdi-deploy
LABEL vdi-deploy
    KERNEL images/deploy/vmlinuz
    APPEND initrd=images/deploy/initrd.img boot=live fetch=http://192.168.100.1/images/$IMAGE_NAME quiet splash deployment_id=$DEPLOYMENT_ID
PXEEOF

echo "Deployment configured for device $DEVICE_MAC"
echo "PXE config: $PXE_CONFIG_FILE"
echo "Image URL: http://192.168.100.1/images/$IMAGE_NAME"
EOF

    chmod +x "/usr/local/bin/vdi-deploy-image"
    
    # Create device registration script
    cat > "/usr/local/bin/vdi-register-device" << 'EOF'
#!/bin/bash
# Device Registration Script

DEVICE_MAC="$1"
DEVICE_IP="$2"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <device_mac> <device_ip>"
    exit 1
fi

# Add DHCP reservation
MAC_CONFIG=$(echo "$DEVICE_MAC" | tr ':' '-' | tr '[:upper:]' '[:lower:]')

# Create DHCP reservation in dnsmasq
echo "dhcp-host=$DEVICE_MAC,$DEVICE_IP,24h" >> /etc/dnsmasq.d/vdi-devices.conf

# Restart dnsmasq to apply changes
systemctl restart dnsmasq 2>/dev/null || service dnsmasq restart 2>/dev/null || rc-service dnsmasq restart

echo "Device $DEVICE_MAC registered with IP $DEVICE_IP"
EOF

    chmod +x "/usr/local/bin/vdi-register-device"
    
    # Create cleanup script
    cat > "/usr/local/bin/vdi-cleanup-deployment" << 'EOF'
#!/bin/bash
# Cleanup deployment files

DEVICE_MAC="$1"

if [ -z "$DEVICE_MAC" ]; then
    echo "Usage: $0 <device_mac>"
    exit 1
fi

TFTP_ROOT="/var/lib/tftpboot"

# Remove device-specific PXE config
MAC_CONFIG=$(echo "$DEVICE_MAC" | tr ':' '-' | tr '[:upper:]' '[:lower:]')
PXE_CONFIG_FILE="$TFTP_ROOT/pxelinux.cfg/01-$MAC_CONFIG"

if [ -f "$PXE_CONFIG_FILE" ]; then
    rm "$PXE_CONFIG_FILE"
    echo "Removed PXE config for device $DEVICE_MAC"
else
    echo "No PXE config found for device $DEVICE_MAC"
fi
EOF

    chmod +x "/usr/local/bin/vdi-cleanup-deployment"
}

create_monitoring_scripts() {
    log "Creating monitoring scripts..."
    
    # Create PXE server status script
    cat > "/usr/local/bin/vdi-pxe-status" << 'EOF'
#!/bin/bash
# PXE Server Status Check

echo "=== VDI PXE Server Status ==="
echo

# Check services
echo "Service Status:"
for service in dnsmasq nginx; do
    if systemctl is-active --quiet $service 2>/dev/null || service $service status >/dev/null 2>&1; then
        echo "  $service: RUNNING"
    else
        echo "  $service: STOPPED"
    fi
done

echo

# Check network
echo "Network Configuration:"
ip addr show | grep -E "(inet |UP|DOWN)" | sed 's/^/  /'

echo

# Check TFTP files
echo "TFTP Boot Files:"
if [ -f "/var/lib/tftpboot/pxelinux.0" ]; then
    echo "  pxelinux.0: OK"
else
    echo "  pxelinux.0: MISSING"
fi

# Check recent DHCP activity
echo
echo "Recent DHCP Activity:"
tail -n 10 /var/log/dnsmasq.log 2>/dev/null | grep DHCP | sed 's/^/  /' || echo "  No recent activity"

echo

# Check deployed images
echo "Available Images:"
ls -la /var/www/html/images/ 2>/dev/null | sed 's/^/  /' || echo "  No images deployed"
EOF

    chmod +x "/usr/local/bin/vdi-pxe-status"
}

start_services() {
    log "Starting services..."
    
    # Create dnsmasq devices configuration directory
    mkdir -p /etc/dnsmasq.d
    
    # Start and enable services
    if command -v systemctl &> /dev/null; then
        systemctl enable dnsmasq nginx
        systemctl start dnsmasq nginx
    elif command -v service &> /dev/null; then
        service dnsmasq start
        service nginx start
    else
        # Alpine Linux with OpenRC
        rc-update add dnsmasq default
        rc-update add nginx default
        rc-service dnsmasq start
        rc-service nginx start
    fi
}

create_firewall_rules() {
    log "Configuring firewall rules..."
    
    # Create iptables rules for PXE services
    cat > "/etc/iptables/vdi-pxe-rules.sh" << 'EOF'
#!/bin/bash
# VDI PXE Server Firewall Rules

# Allow DHCP
iptables -A INPUT -p udp --dport 67 -j ACCEPT
iptables -A INPUT -p udp --dport 68 -j ACCEPT

# Allow TFTP
iptables -A INPUT -p udp --dport 69 -j ACCEPT

# Allow HTTP
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow DNS
iptables -A INPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p tcp --dport 53 -j ACCEPT

# Save rules
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
EOF

    chmod +x "/etc/iptables/vdi-pxe-rules.sh"
}

main() {
    log "Starting VDI PXE server setup..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log "ERROR: This script must be run as root"
        exit 1
    fi
    
    install_packages
    setup_directories
    configure_dnsmasq
    setup_pxe_boot_files
    configure_nginx
    create_deployment_scripts
    create_monitoring_scripts
    create_firewall_rules
    start_services
    
    log "PXE server setup completed successfully!"
    log "Server IP: $PXE_SERVER_IP"
    log "DHCP Range: $PXE_RANGE_START - $PXE_RANGE_END"
    log "TFTP Root: $TFTP_ROOT"
    log "HTTP Root: $HTTP_ROOT"
    log ""
    log "Management Commands:"
    log "  vdi-deploy-image <image_path> <device_mac> <deployment_id>"
    log "  vdi-register-device <device_mac> <device_ip>"
    log "  vdi-cleanup-deployment <device_mac>"
    log "  vdi-pxe-status"
    log ""
    log "Next steps:"
    log "1. Copy your thin client images to $HTTP_ROOT"
    log "2. Configure your network to route PXE traffic to this server"
    log "3. Test with a thin client device"
}

main "$@"