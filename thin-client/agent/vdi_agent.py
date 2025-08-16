#!/usr/bin/env python3
"""
VDI Thin Client Management Agent
Runs on each thin client for remote management and monitoring
"""

import os
import sys
import json
import time
import uuid
import psutil
import requests
import subprocess
import threading
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Ensure log directory exists before configuring logging
Path('/var/log/vdi').mkdir(parents=True, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vdi/agent.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('vdi-agent')

class VDIClientAgent:
    """Main VDI client management agent"""
    
    def __init__(self, config_path: str = "/etc/vdi/agent-config.json"):
        self.config = self.load_config(config_path)
        self.device_id = self.get_device_id()
        self.server_url = self.config.get("server_url", "https://vdi-management.company.com")
        self.heartbeat_interval = self.config.get("heartbeat_interval", 60)
        self.running = True
        
        # Create required directories
        Path("/var/log/vdi").mkdir(parents=True, exist_ok=True)
        Path("/var/lib/vdi").mkdir(parents=True, exist_ok=True)
        
        logger.info(f"VDI Agent initialized - Device ID: {self.device_id}")
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load agent configuration"""
        default_config = {
            "server_url": "https://vdi-management.company.com",
            "heartbeat_interval": 60,
            "enable_remote_commands": True,
            "max_command_timeout": 300,
            "log_level": "INFO",
            "hardware_monitoring": True,
            "network_monitoring": True,
            "process_monitoring": True
        }
        
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
        except Exception as e:
            logger.warning(f"Could not load config from {config_path}: {e}")
        
        return default_config
    
    def get_device_id(self) -> str:
        """Generate unique device ID from MAC address"""
        try:
            # Try to get primary network interface MAC
            interfaces = psutil.net_if_addrs()
            for interface_name, addresses in interfaces.items():
                if interface_name.startswith(('eth', 'enp', 'ens')):
                    for address in addresses:
                        if address.family == psutil.AF_LINK:  # MAC address
                            return address.address.replace(':', '').lower()
            
            # Fallback: use first available MAC
            for interface_name, addresses in interfaces.items():
                for address in addresses:
                    if address.family == psutil.AF_LINK and address.address != '00:00:00:00:00:00':
                        return address.address.replace(':', '').lower()
        except Exception as e:
            logger.warning(f"Could not get MAC address: {e}")
        
        # Last resort: generate UUID and save it
        device_id_file = Path("/var/lib/vdi/device-id")
        if device_id_file.exists():
            return device_id_file.read_text().strip()
        else:
            device_id = str(uuid.uuid4())
            device_id_file.write_text(device_id)
            return device_id
    
    def collect_system_info(self) -> Dict[str, Any]:
        """Collect comprehensive system information"""
        try:
            # Basic system info
            uname = os.uname()
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            
            # CPU information
            cpu_info = {
                "usage_percent": psutil.cpu_percent(interval=1),
                "count": psutil.cpu_count(),
                "count_logical": psutil.cpu_count(logical=True),
                "freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
            }
            
            # Memory information
            memory = psutil.virtual_memory()
            memory_info = {
                "total": memory.total,
                "used": memory.used,
                "free": memory.free,
                "percent": memory.percent,
                "available": memory.available
            }
            
            # Disk information
            disk_usage = []
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage.append({
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percent": (usage.used / usage.total) * 100 if usage.total > 0 else 0
                    })
                except PermissionError:
                    continue
            
            # Network information
            network_info = self.get_network_info()
            
            # Process information
            process_count = len(psutil.pids())
            
            # RDP session information
            rdp_sessions = self.get_rdp_sessions()
            
            # Hardware information
            hardware_info = self.get_hardware_info()
            
            return {
                "device_id": self.device_id,
                "hostname": uname.nodename,
                "timestamp": datetime.now().isoformat(),
                "uptime_seconds": (datetime.now() - boot_time).total_seconds(),
                "system": {
                    "os": f"{uname.sysname} {uname.release}",
                    "architecture": uname.machine,
                    "kernel_version": uname.version
                },
                "cpu": cpu_info,
                "memory": memory_info,
                "disk": disk_usage,
                "network": network_info,
                "processes": {
                    "total_count": process_count
                },
                "rdp_sessions": rdp_sessions,
                "hardware": hardware_info,
                "agent_version": "1.0.0"
            }
            
        except Exception as e:
            logger.error(f"Error collecting system info: {e}")
            return {
                "device_id": self.device_id,
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }
    
    def get_network_info(self) -> Dict[str, Any]:
        """Collect network interface information"""
        try:
            interfaces = {}
            stats = psutil.net_io_counters(pernic=True)
            addrs = psutil.net_if_addrs()
            
            for interface_name in addrs.keys():
                interface_info = {
                    "addresses": [],
                    "statistics": None
                }
                
                # Get addresses
                for address in addrs[interface_name]:
                    addr_info = {
                        "family": str(address.family),
                        "address": address.address
                    }
                    if hasattr(address, 'netmask') and address.netmask:
                        addr_info["netmask"] = address.netmask
                    interface_info["addresses"].append(addr_info)
                
                # Get statistics
                if interface_name in stats:
                    stat = stats[interface_name]
                    interface_info["statistics"] = {
                        "bytes_sent": stat.bytes_sent,
                        "bytes_recv": stat.bytes_recv,
                        "packets_sent": stat.packets_sent,
                        "packets_recv": stat.packets_recv,
                        "errin": stat.errin,
                        "errout": stat.errout,
                        "dropin": stat.dropin,
                        "dropout": stat.dropout
                    }
                
                interfaces[interface_name] = interface_info
            
            return {
                "interfaces": interfaces,
                "default_gateway": self.get_default_gateway()
            }
            
        except Exception as e:
            logger.error(f"Error getting network info: {e}")
            return {"error": str(e)}
    
    def get_default_gateway(self) -> Optional[str]:
        """Get default gateway IP address"""
        try:
            result = subprocess.run(['ip', 'route', 'show', 'default'], 
                                 capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'default via' in line:
                        parts = line.split()
                        for i, part in enumerate(parts):
                            if part == 'via' and i + 1 < len(parts):
                                return parts[i + 1]
        except Exception as e:
            logger.debug(f"Could not get default gateway: {e}")
        return None
    
    def get_rdp_sessions(self) -> List[Dict[str, Any]]:
        """Get information about active RDP sessions"""
        sessions = []
        try:
            # Look for FreeRDP processes
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                try:
                    if proc.info['name'] and 'xfreerdp' in proc.info['name']:
                        session_info = {
                            "pid": proc.info['pid'],
                            "command": ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else '',
                            "started_at": datetime.fromtimestamp(proc.info['create_time']).isoformat(),
                            "status": "active"
                        }
                        
                        # Extract server info from command line
                        if proc.info['cmdline']:
                            for arg in proc.info['cmdline']:
                                if arg.startswith('/v:'):
                                    session_info["server"] = arg[3:]
                                elif arg.startswith('/u:'):
                                    session_info["username"] = arg[3:]
                                elif arg.startswith('/d:'):
                                    session_info["domain"] = arg[3:]
                        
                        sessions.append(session_info)
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
        except Exception as e:
            logger.error(f"Error getting RDP sessions: {e}")
            
        return sessions
    
    def get_hardware_info(self) -> Dict[str, Any]:
        """Get hardware information"""
        try:
            hardware = {}
            
            # CPU info
            try:
                with open('/proc/cpuinfo', 'r') as f:
                    cpu_info = f.read()
                    if 'model name' in cpu_info:
                        for line in cpu_info.split('\n'):
                            if line.startswith('model name'):
                                hardware['cpu_model'] = line.split(':')[1].strip()
                                break
            except:
                pass
            
            # Memory info
            try:
                with open('/proc/meminfo', 'r') as f:
                    meminfo = f.read()
                    for line in meminfo.split('\n'):
                        if line.startswith('MemTotal:'):
                            hardware['memory_total_kb'] = int(line.split()[1])
                            break
            except:
                pass
            
            # PCI devices (graphics, network, etc.)
            try:
                result = subprocess.run(['lspci', '-mm'], capture_output=True, text=True)
                if result.returncode == 0:
                    devices = []
                    for line in result.stdout.strip().split('\n'):
                        if line:
                            devices.append(line)
                    hardware['pci_devices'] = devices
            except:
                pass
            
            # USB devices
            try:
                result = subprocess.run(['lsusb'], capture_output=True, text=True)
                if result.returncode == 0:
                    devices = []
                    for line in result.stdout.strip().split('\n'):
                        if line and 'root hub' not in line.lower():
                            devices.append(line)
                    hardware['usb_devices'] = devices
            except:
                pass
            
            return hardware
            
        except Exception as e:
            logger.error(f"Error getting hardware info: {e}")
            return {"error": str(e)}
    
    def send_heartbeat(self) -> bool:
        """Send heartbeat to management server"""
        try:
            system_info = self.collect_system_info()
            
            response = requests.post(
                f"{self.server_url}/api/devices/{self.device_id}/heartbeat",
                json=system_info,
                timeout=30,
                verify=False  # For development - should use proper certs in production
            )
            
            if response.status_code == 200:
                # Process any commands from server
                response_data = response.json()
                commands = response_data.get('commands', [])
                
                if commands:
                    logger.info(f"Received {len(commands)} commands from server")
                    for command in commands:
                        self.handle_command(command)
                
                return True
            else:
                logger.warning(f"Heartbeat failed with status {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during heartbeat: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during heartbeat: {e}")
            return False
    
    def handle_command(self, command: Dict[str, Any]):
        """Handle command from management server"""
        try:
            command_id = command.get('id')
            command_type = command.get('type')
            command_data = command.get('data', {})
            
            logger.info(f"Processing command {command_id}: {command_type}")
            
            result = None
            
            if command_type == 'execute_script':
                result = self.execute_script(command_data.get('script', ''))
            elif command_type == 'restart_system':
                result = self.restart_system(command_data.get('delay', 0))
            elif command_type == 'update_config':
                result = self.update_config(command_data.get('config', {}))
            elif command_type == 'install_package':
                result = self.install_package(command_data.get('package', ''))
            elif command_type == 'update_image':
                result = self.update_image(command_data.get('image_url', ''), 
                                        command_data.get('image_hash', ''))
            elif command_type == 'collect_logs':
                result = self.collect_logs(command_data.get('lines', 100))
            elif command_type == 'restart_service':
                result = self.restart_service(command_data.get('service', ''))
            else:
                result = {"success": False, "error": f"Unknown command type: {command_type}"}
            
            # Send command result back to server
            self.send_command_result(command_id, result)
            
        except Exception as e:
            logger.error(f"Error handling command: {e}")
            self.send_command_result(command.get('id'), {
                "success": False,
                "error": str(e)
            })
    
    def execute_script(self, script: str) -> Dict[str, Any]:
        """Execute shell script"""
        try:
            if not self.config.get("enable_remote_commands", False):
                return {"success": False, "error": "Remote commands are disabled"}
            
            result = subprocess.run(
                script,
                shell=True,
                capture_output=True,
                text=True,
                timeout=self.config.get("max_command_timeout", 300)
            )
            
            return {
                "success": result.returncode == 0,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Script execution timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def restart_system(self, delay: int = 0) -> Dict[str, Any]:
        """Restart the system"""
        try:
            if delay > 0:
                subprocess.Popen([
                    'sh', '-c', f'sleep {delay} && reboot'
                ])
            else:
                subprocess.Popen(['reboot'])
            
            return {"success": True, "message": f"System restart initiated (delay: {delay}s)"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def update_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        """Update agent configuration"""
        try:
            config_path = "/etc/vdi/agent-config.json"
            
            # Merge with existing config
            current_config = self.load_config(config_path)
            current_config.update(new_config)
            
            # Save updated config
            with open(config_path, 'w') as f:
                json.dump(current_config, f, indent=2)
            
            # Update runtime config
            self.config.update(new_config)
            
            return {"success": True, "message": "Configuration updated successfully"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def install_package(self, package: str) -> Dict[str, Any]:
        """Install Alpine package"""
        try:
            result = subprocess.run([
                'apk', 'add', package
            ], capture_output=True, text=True)
            
            return {
                "success": result.returncode == 0,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def update_image(self, image_url: str, image_hash: str) -> Dict[str, Any]:
        """Download and schedule image update"""
        try:
            # Download new image
            response = requests.get(image_url, stream=True)
            response.raise_for_status()
            
            temp_image = f"/tmp/update-{int(time.time())}.img"
            
            with open(temp_image, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Verify image integrity
            import hashlib
            with open(temp_image, 'rb') as f:
                calculated_hash = hashlib.sha256(f.read()).hexdigest()
            
            if calculated_hash != image_hash:
                os.remove(temp_image)
                return {"success": False, "error": "Image hash mismatch"}
            
            # Schedule update for next reboot
            update_script = f"""#!/bin/sh
# VDI Image Update Script
cp {temp_image} /boot/vdi-update.img
rm {temp_image}
reboot
"""
            
            with open('/tmp/vdi-update.sh', 'w') as f:
                f.write(update_script)
            os.chmod('/tmp/vdi-update.sh', 0o755)
            
            return {"success": True, "message": "Image update scheduled for next reboot"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def collect_logs(self, lines: int = 100) -> Dict[str, Any]:
        """Collect recent log entries"""
        try:
            logs = {}
            
            # VDI agent logs
            try:
                with open('/var/log/vdi/agent.log', 'r') as f:
                    log_lines = f.readlines()
                    logs['vdi_agent'] = log_lines[-lines:]
            except:
                logs['vdi_agent'] = []
            
            # System logs
            try:
                result = subprocess.run([
                    'dmesg', '--human', '--time-format=iso'
                ], capture_output=True, text=True)
                if result.returncode == 0:
                    logs['dmesg'] = result.stdout.split('\n')[-lines:]
            except:
                logs['dmesg'] = []
            
            return {"success": True, "logs": logs}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def restart_service(self, service: str) -> Dict[str, Any]:
        """Restart system service"""
        try:
            result = subprocess.run([
                'rc-service', service, 'restart'
            ], capture_output=True, text=True)
            
            return {
                "success": result.returncode == 0,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def send_command_result(self, command_id: str, result: Dict[str, Any]):
        """Send command execution result to server"""
        try:
            requests.post(
                f"{self.server_url}/api/devices/{self.device_id}/command-result",
                json={
                    "command_id": command_id,
                    "result": result,
                    "timestamp": datetime.now().isoformat()
                },
                timeout=30,
                verify=False
            )
        except Exception as e:
            logger.error(f"Failed to send command result: {e}")
    
    def run_agent_loop(self):
        """Main agent loop"""
        logger.info("Starting VDI agent main loop")
        
        while self.running:
            try:
                # Send heartbeat
                success = self.send_heartbeat()
                
                if success:
                    logger.debug("Heartbeat sent successfully")
                else:
                    logger.warning("Heartbeat failed")
                
            except Exception as e:
                logger.error(f"Error in agent loop: {e}")
            
            # Sleep until next heartbeat
            time.sleep(self.heartbeat_interval)
    
    def stop(self):
        """Stop the agent"""
        logger.info("Stopping VDI agent")
        self.running = False


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    global agent
    if agent:
        agent.stop()
    sys.exit(0)


def main():
    """Main entry point"""
    import signal
    
    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Create and start agent
    global agent
    agent = VDIClientAgent()
    
    try:
        agent.run_agent_loop()
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
    except Exception as e:
        logger.error(f"Agent crashed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()